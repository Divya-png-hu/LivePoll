package config

import (
	"context"
	"fmt"
	"os"

	"github.com/redis/go-redis/v9"
)

var RedisClient *redis.Client

func ConnectRedis() error {
	redisURL := os.Getenv("REDIS_URL")

	if redisURL == "" {
		return fmt.Errorf("REDIS_URL is missing from .env")
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return fmt.Errorf("invalid REDIS_URL: %w", err)
	}

	RedisClient = redis.NewClient(opt)

	ctx := context.Background()

	if err := RedisClient.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("Redis PING failed: %w", err)
	}

	return nil
}