package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type PollOption struct {
	ID   string `bson:"id" json:"id"`
	Text string `bson:"text" json:"text"`
}

type Poll struct {
	ID        bson.ObjectID `bson:"_id,omitempty" json:"id"`
	CreatorID string        `bson:"creatorId" json:"creatorId"`
	Question  string        `bson:"question" json:"question"`
	Options   []PollOption  `bson:"options" json:"options"`
	IsActive  bool          `bson:"isActive" json:"isActive"`
	CreatedAt time.Time     `bson:"createdAt" json:"createdAt"`
}
