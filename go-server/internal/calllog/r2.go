package calllog

import (
	"bytes"
	"context"
	"fmt"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

const r2AudioPrefix = "r2://"

// AudioStore persists and retrieves call recordings.
type AudioStore interface {
	Upload(ctx context.Context, key, contentType string, data []byte) error
	Open(ctx context.Context, key string) (io.ReadCloser, error)
}

type r2Store struct {
	client *s3.Client
	bucket string
}

func NewR2Store(ctx context.Context, endpoint, accessKeyID, secretAccessKey, bucket, region string) (AudioStore, error) {
	if endpoint == "" || accessKeyID == "" || secretAccessKey == "" || bucket == "" {
		return nil, nil
	}
	if region == "" {
		region = "auto"
	}

	cfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, "")),
	)
	if err != nil {
		return nil, fmt.Errorf("load r2 config: %w", err)
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	})
	return &r2Store{client: client, bucket: bucket}, nil
}

func (s *r2Store) Upload(ctx context.Context, key, contentType string, data []byte) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	})
	return err
}

func (s *r2Store) Open(ctx context.Context, key string) (io.ReadCloser, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, err
	}
	return out.Body, nil
}

func r2AudioPath(key string) string {
	return r2AudioPrefix + key
}
