package main

import (
	"context"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"livepoll/backend/config"
	"livepoll/backend/handlers"
	"livepoll/backend/middleware"
)

var mongoClient *mongo.Client

func connectMongoDB() error {
	err := godotenv.Load()
	if err != nil {
		return err
	}

	mongoURI := os.Getenv("MONGO_URI")

	if mongoURI == "" {
		return os.ErrNotExist
	}

	serverAPI := options.ServerAPI(options.ServerAPIVersion1)

	opts := options.Client().
		ApplyURI(mongoURI).
		SetServerAPIOptions(serverAPI)

	ctx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	mongoClient, err = mongo.Connect(opts)
	if err != nil {
		return err
	}

	err = mongoClient.Ping(ctx, nil)
	if err != nil {
		return err
	}

	return nil
}

func main() {

	err := connectMongoDB()
	if err != nil {
		panic("MongoDB connection failed: " + err.Error())
	}

	println("MongoDB connected successfully!")

	err = config.ConnectRedis()
	if err != nil {
		panic("Redis connection failed: " + err.Error())
	}

	println("Redis connected successfully!")

	// MongoDB database and collection
	db := mongoClient.Database("livepoll")

	userCollection := db.Collection("users")
	pollCollection := db.Collection("polls")
	voteCollection := db.Collection("votes")

	// Authentication handler
	authHandler := &handlers.AuthHandler{
		UserCollection: userCollection,
	}
	pollHandler := &handlers.PollHandler{
		PollCollection: pollCollection,
		VoteCollection: voteCollection,
		RedisClient:    config.RedisClient,
	}

	router := gin.Default()
	router.Use(cors.New(cors.Config{
		AllowOrigins: []string{
    		"http://localhost:5173",
    		"http://192.168.29.154:5173",
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		AllowCredentials: true,
	}))

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"message": "LivePoll backend is running",
			"mongodb": "connected",
		})
	})

	// Authentication routes
	router.POST("/api/auth/signup", authHandler.Signup)
	router.POST("/api/auth/login", authHandler.Login)
	router.POST("/api/polls", middleware.AuthRequired(), pollHandler.CreatePoll)
	router.GET("/api/polls/:id", pollHandler.GetPoll)
	router.POST("/api/polls/:id/vote", pollHandler.Vote)
	router.GET("/api/polls/:id/live", pollHandler.LiveResults)
	router.GET("/api/polls/:id/results", pollHandler.GetResults)
	router.GET("/api/polls/my", middleware.AuthRequired(), pollHandler.GetMyPolls)
	router.PUT("/api/polls/:id/close", middleware.AuthRequired(), pollHandler.ClosePoll)

	// Protected test route
	router.GET("/api/protected", middleware.AuthRequired(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "You are authenticated!",
			"user_id": c.GetString("user_id"),
		})
	})

	port := os.Getenv("PORT")

	if port == "" {
    	port = "8081"
	}

	router.Run("0.0.0.0:" + port)
}
