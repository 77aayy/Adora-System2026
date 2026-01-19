#!/bin/bash

# ============================================================
# Adora Hotel Management System - Deployment Script
# ============================================================
# 
# Usage: ./deploy.sh [environment]
# 
# Environments:
#   - production (default)
#   - staging
#   - development
# 
# Prerequisites:
#   - Node.js 18+
#   - Firebase CLI installed and logged in
#   - Git for version control
# 
# ============================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Environment (default: production)
ENVIRONMENT=${1:-production}

# Banner
echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║          🏨 ADORA HOTEL MANAGEMENT SYSTEM              ║"
echo "║              Deployment Script v3.0                    ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}📦 Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo ""

# Step 1: Pre-flight checks
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}🔍 Step 1: Pre-flight Checks${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js: ${NODE_VERSION}${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi
NPM_VERSION=$(npm -v)
echo -e "${GREEN}✅ npm: ${NPM_VERSION}${NC}"

# Check Firebase CLI
if ! command -v firebase &> /dev/null; then
    echo -e "${YELLOW}⚠️  Firebase CLI not found. Installing...${NC}"
    npm install -g firebase-tools
fi
FIREBASE_VERSION=$(firebase --version)
echo -e "${GREEN}✅ Firebase CLI: ${FIREBASE_VERSION}${NC}"

echo ""

# Step 2: Install dependencies
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📦 Step 2: Installing Dependencies${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

npm ci --silent
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 3: Run linting
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}🔍 Step 3: Code Quality Check${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Skip TypeScript strict checking for now (handled in build)
echo -e "${YELLOW}⚡ Skipping strict TypeScript check (using build-time check)${NC}"
echo ""

# Step 4: Build
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}🔨 Step 4: Building for ${ENVIRONMENT}${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Build based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    NODE_ENV=production npm run build
else
    npm run build
fi

# Check if build succeeded
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build failed - dist folder not found${NC}"
    exit 1
fi

BUILD_SIZE=$(du -sh dist | cut -f1)
echo -e "${GREEN}✅ Build complete (${BUILD_SIZE})${NC}"
echo ""

# Step 5: Deploy
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}🚀 Step 5: Deploying to Firebase${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Deploy based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    firebase deploy --only hosting
elif [ "$ENVIRONMENT" = "staging" ]; then
    firebase deploy --only hosting:staging
else
    firebase deploy --only hosting:dev
fi

echo ""

# Step 6: Success
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Deployment Successful!${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  ${GREEN}🚀 Project Adora is Live!${CYAN}                           ║${NC}"
echo -e "${CYAN}║                                                        ║${NC}"
echo -e "${CYAN}║  ${YELLOW}Environment:${NC} ${ENVIRONMENT}                               ${CYAN}║${NC}"
echo -e "${CYAN}║  ${YELLOW}Build Size:${NC}  ${BUILD_SIZE}                                   ${CYAN}║${NC}"
echo -e "${CYAN}║  ${YELLOW}Deployed at:${NC} $(date '+%Y-%m-%d %H:%M:%S')              ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Git tag for production
if [ "$ENVIRONMENT" = "production" ]; then
    DEPLOY_TAG="deploy-$(date '+%Y%m%d-%H%M%S')"
    echo -e "${BLUE}📌 Creating deployment tag: ${DEPLOY_TAG}${NC}"
    git tag -a "$DEPLOY_TAG" -m "Production deployment at $(date)" 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}✅ All done! Adora is ready to serve guests 🏨${NC}"
