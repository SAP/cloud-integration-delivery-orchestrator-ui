# Makefile for automated CloudFoundry deployment
.PHONY: help login build deploy all clean

# Default target
all: deploy

# CloudFoundry API endpoint
CF_API ?= https://api.cf.sap.hana.ondemand.com
# CloudFoundry organization
CF_ORG ?= MaCo-devops
# CloudFoundry space
CF_SPACE ?= DEVOPS
CF_USER ?= # username
CF_PASS ?= # Password
help:
	@echo "Available targets:"
	@echo "  make login        - Login to CloudFoundry (requires CF_API, CF_ORG, CF_SPACE)"
	@echo "  make build        - Build the MTA archive using mbt"
	@echo "  make deploy       - Deploy to CloudFoundry using cf deploy"
	@echo "  make all          - Execute build and deploy (default)"
	@echo "  make clean        - Remove build artifacts"
	@echo ""
	@echo "Example usage:"
	@echo "  make login CF_API=https://api.cf.sap.hana.ondemand.com CF_ORG=my-org CF_SPACE=dev"
	@echo "  make deploy"

login:
	@echo "Logging in to CloudFoundry..."
	@cf login -a $(CF_API) -o $(CF_ORG) -s $(CF_SPACE) -u $(CF_USER) -p $(CF_PASS) --skip-ssl-validation
	@echo "Setting target to org: $(CF_ORG), space: $(CF_SPACE)"
	@echo "Login successful!"

build:
	@echo "Building MTA archive..."
	@mbt build
	@echo "Build complete!"

deploy: login build
	@echo "Deploying to CloudFoundry..."
	@cf deploy mta_archives/*.mtar
	@echo "Deployment complete!"

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf mta_archives/
	@rm -rf dist/
	@echo "Clean complete!"