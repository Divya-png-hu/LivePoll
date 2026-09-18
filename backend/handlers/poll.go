package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"

	"livepoll/backend/models"
)

type PollHandler struct {
	PollCollection *mongo.Collection
	VoteCollection *mongo.Collection
	RedisClient    *redis.Client
}

type CreatePollRequest struct {
	Question string   `json:"question"`
	Options  []string `json:"options"`
}

func (h *PollHandler) CreatePoll(c *gin.Context) {
	var request CreatePollRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request data",
		})
		return
	}

	if request.Question == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Question is required",
		})
		return
	}

	if len(request.Options) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "At least 2 options are required",
		})
		return
	}

	options := make([]models.PollOption, 0, len(request.Options))

	for _, optionText := range request.Options {
		if optionText == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Options cannot be empty",
			})
			return
		}

		options = append(options, models.PollOption{
			ID:   bson.NewObjectID().Hex(),
			Text: optionText,
		})
	}

	userID := c.GetString("user_id")

	poll := models.Poll{
		ID:        bson.NewObjectID(),
		CreatorID: userID,
		Question:  request.Question,
		Options:   options,
		IsActive:  true,
		CreatedAt: time.Now(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := h.PollCollection.InsertOne(ctx, poll)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Could not create poll",
		})
		return
	}
	// Initialize Redis result counts
	resultsKey := "poll:" + poll.ID.Hex() + ":results"

	for _, option := range poll.Options {
		err = h.RedisClient.HSet(
			ctx,
			resultsKey,
			option.ID,
			0,
		).Err()

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Could not initialize poll results",
			})
			return
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Poll created successfully",
		"poll":    poll,
	})
}
func (h *PollHandler) GetPoll(c *gin.Context) {
	pollID := c.Param("id")

	objectID, err := bson.ObjectIDFromHex(pollID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid poll ID",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var poll models.Poll

	err = h.PollCollection.FindOne(
		ctx,
		bson.M{"_id": objectID},
	).Decode(&poll)

	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Poll not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Could not retrieve poll",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"poll": poll,
	})
}

type VoteRequest struct {
	OptionID string `json:"optionId"`
}

func (h *PollHandler) Vote(c *gin.Context) {
	pollID := c.Param("id")

	objectID, err := bson.ObjectIDFromHex(pollID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid poll ID",
		})
		return
	}

	var request VoteRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request data",
		})
		return
	}

	if request.OptionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Option ID is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var poll models.Poll

	err = h.PollCollection.FindOne(
		ctx,
		bson.M{"_id": objectID},
	).Decode(&poll)
	if !poll.IsActive {
    	c.JSON(http.StatusBadRequest, gin.H{
        	"error": "This poll is closed",
    	})
    	return
	}

	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Poll not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Could not retrieve poll",
		})
		return
	}

	// Check that the selected option belongs to this poll
	optionExists := false

	for _, option := range poll.Options {
		if option.ID == request.OptionID {
			optionExists = true
			break
		}
	}

	if !optionExists {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid option for this poll",
		})
		return
	}

	// Identify the browser
	voterToken, err := c.Cookie("voter_token")

	if err != nil || voterToken == "" {
		voterToken = bson.NewObjectID().Hex()

		http.SetCookie(c.Writer, &http.Cookie{
			Name:     "voter_token",
			Value:    voterToken,
			Path:     "/",
			MaxAge:   60 * 60 * 24 * 365,
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
		})
	}

	// Check whether this browser already voted
	var existingVote models.Vote

	err = h.VoteCollection.FindOne(
		ctx,
		bson.M{
			"pollId":     pollID,
			"voterToken": voterToken,
		},
	).Decode(&existingVote)

	if err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"error": "You have already voted in this poll",
		})
		return
	}

	if err != mongo.ErrNoDocuments {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Could not check previous vote",
		})
		return
	}

	// Save vote in MongoDB
	vote := models.Vote{
		ID:         bson.NewObjectID(),
		PollID:     pollID,
		OptionID:   request.OptionID,
		VoterToken: voterToken,
		CreatedAt:  time.Now(),
	}

	_, err = h.VoteCollection.InsertOne(ctx, vote)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Could not save vote",
		})
		return
	}

	// Update live vote count in Redis
	resultsKey := "poll:" + pollID + ":results"

	err = h.RedisClient.HIncrBy(
		ctx,
		resultsKey,
		request.OptionID,
		1,
	).Err()

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Could not update live results",
		})
		return
	}

	// Notify all connected clients
	eventChannel := "poll:" + pollID + ":events"

	err = h.RedisClient.Publish(
		ctx,
		eventChannel,
		request.OptionID,
	).Err()

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Could not publish live update",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Vote recorded successfully",
	})
}
func (h *PollHandler) LiveResults(c *gin.Context) {
	pollID := c.Param("id")

	channel := "poll:" + pollID + ":events"
	resultsKey := "poll:" + pollID + ":results"

	pubsub := h.RedisClient.Subscribe(
		c.Request.Context(),
		channel,
	)
	defer pubsub.Close()

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	c.Stream(func(w io.Writer) bool {
		msg, err := pubsub.ReceiveMessage(c.Request.Context())

		if err != nil {
			return false
		}

		count, err := h.RedisClient.HGet(
			c.Request.Context(),
			resultsKey,
			msg.Payload,
		).Result()

		if err != nil {
			return false
		}

		fmt.Fprintf(
			w,
			"data: {\"optionId\":\"%s\",\"count\":%s}\n\n",
			msg.Payload,
			count,
		)

		return true
	})
}
func (h *PollHandler) GetResults(c *gin.Context) {
	pollID := c.Param("id")

	resultsKey := "poll:" + pollID + ":results"

	results, err := h.RedisClient.HGetAll(
		c.Request.Context(),
		resultsKey,
	).Result()

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Could not get results",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": results,
	})
}
func (h *PollHandler) GetMyPolls(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Unauthorized",
		})
		return
	}

	creatorID, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid user ID",
		})
		return
	}

	cursor, err := h.PollCollection.Find(
		c.Request.Context(),
		bson.M{"creatorId": creatorID},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Could not fetch polls",
		})
		return
	}
	defer cursor.Close(c.Request.Context())

	var polls []models.Poll

	if err := cursor.All(c.Request.Context(), &polls); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Could not read polls",
		})
		return
	}

	if polls == nil {
		polls = []models.Poll{}
	}

	c.JSON(http.StatusOK, gin.H{
		"polls": polls,
	})
}
func (h *PollHandler) ClosePoll(c *gin.Context) {
	pollID, err := bson.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid poll ID",
		})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Unauthorized",
		})
		return
	}

	creatorID, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid user ID",
		})
		return
	}

	// Only the creator can close the poll.
	filter := bson.M{
		"_id":       pollID,
		"creatorId": creatorID,
	}

	update := bson.M{
		"$set": bson.M{
			"isActive": false,
		},
	}

	result, err := h.PollCollection.UpdateOne(
		c.Request.Context(),
		filter,
		update,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Could not close poll",
		})
		return
	}

	if result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Poll not found or you are not the creator",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Poll closed successfully",
	})
}