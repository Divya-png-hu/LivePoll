package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type Vote struct {
	ID         bson.ObjectID `bson:"_id,omitempty" json:"id"`
	PollID     string        `bson:"pollId" json:"pollId"`
	OptionID   string        `bson:"optionId" json:"optionId"`
	VoterToken string        `bson:"voterToken" json:"-"`
	CreatedAt  time.Time     `bson:"createdAt" json:"createdAt"`
}