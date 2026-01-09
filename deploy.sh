#!/bin/bash

echo "🥦 BroccoByte Deployment Script"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -f "VERCEL_DEPLOY.md" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

echo "📦 Step 1: Installing dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "🔨 Step 2: Testing build..."
cd frontend
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed. Fix errors before deploying."
    exit 1
fi
cd ..

echo ""
echo "✅ Ready to deploy!"
echo ""
echo "Choose deployment method:"
echo "1. Deploy via Vercel CLI (fastest)"
echo "2. Push to GitHub and deploy via Vercel website"
echo ""
read -p "Enter choice (1 or 2): " choice

if [ "$choice" = "1" ]; then
    echo ""
    echo "🚀 Deploying to Vercel..."

    # Check if vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        echo "Installing Vercel CLI..."
        npm install -g vercel
    fi

    cd frontend
    vercel --prod

    echo ""
    echo "✅ Deployment complete!"
    echo "Your app is now live at the URL shown above"

elif [ "$choice" = "2" ]; then
    echo ""
    echo "📝 GitHub Deployment Instructions:"
    echo ""
    echo "1. Create a new repository on GitHub"
    echo "2. Run these commands:"
    echo ""
    echo "   git init"
    echo "   git add ."
    echo "   git commit -m \"BroccoByte - GPU Sharing Platform\""
    echo "   git remote add origin https://github.com/YOUR_USERNAME/broccobyte.git"
    echo "   git branch -M main"
    echo "   git push -u origin main"
    echo ""
    echo "3. Go to https://vercel.com"
    echo "4. Click 'Add New Project'"
    echo "5. Import your GitHub repository"
    echo "6. Set Root Directory to: frontend"
    echo "7. Click Deploy"
    echo ""

else
    echo "Invalid choice. Exiting."
    exit 1
fi

echo ""
echo "🎉 Done! Your BroccoByte platform is ready!"
echo ""
echo "📋 Important URLs:"
echo "   - Smart Contracts: https://sepolia.etherscan.io/"
echo "   - GPURegistry: 0x25701aCCf2B9774afE71f43f4e010Eb82a0A7444"
echo "   - JobMarketplace: 0x9C1c395C0B1B15eF4DE0B618597b1e221b7E2128"
echo ""
echo "💡 Users need:"
echo "   - MetaMask installed"
echo "   - Sepolia testnet configured"
echo "   - Test ETH from faucet"
echo ""
