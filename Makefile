PROJECT  := gentle-current-473717-q4
REGION   := asia-southeast1
SERVICE  := claviq-voice

.PHONY: deploy-backend deploy-frontend deploy redeploy-frontend

## Deploy Go backend to Cloud Run
deploy-backend:
	gcloud run deploy $(SERVICE) \
		--source ./go-server \
		--region $(REGION) \
		--project $(PROJECT)

## Deploy frontend to Vercel (production)
deploy-frontend:
	cd frontend && vercel deploy --prod --yes

## Deploy both
deploy: deploy-backend deploy-frontend

## Force a clean Vercel build by bumping DEPLOY_TRIGGER date
redeploy-frontend:
	date +%Y-%m-%d > frontend/DEPLOY_TRIGGER
	cd frontend && vercel deploy --prod --yes
