# 🚀 Deploy BroccoByte to Vercel

## Quick Deploy (2 Methods)

### Method 1: Deploy via GitHub (Recommended)

1. **Push to GitHub:**
```bash
cd /Users/rudranshg/ethereum-gpu-depin
git init
git add .
git commit -m "BroccoByte - GPU Sharing Platform"

# Create repo on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/broccobyte.git
git branch -M main
git push -u origin main
```

2. **Deploy on Vercel:**
   - Go to https://vercel.com
   - Click "Add New Project"
   - Import your GitHub repo
   - **Root Directory:** `frontend`
   - Click "Deploy"
   - Done! ✅

### Method 2: Deploy via CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to frontend
cd frontend

# Login (first time)
vercel login

# Deploy
vercel --prod
```

---

## ✅ Will It Work?

**YES! Here's why:**

1. **Smart Contracts Already Deployed to Sepolia:**
   - GPURegistry: `0x25701aCCf2B9774afE71f43f4e010Eb82a0A7444`
   - JobMarketplace: `0x9C1c395C0B1B15eF4DE0B618597b1e221b7E2128`

2. **No Backend Required:**
   - All data on blockchain
   - MetaMask connects from any domain
   - Works exactly like localhost

3. **Frontend is Static:**
   - Just HTML/CSS/JS
   - Vercel hosts it perfectly
   - No environment variables needed

---

## 🌐 After Deployment

Your app will be live at: `https://broccobyte-xyz.vercel.app`

**Anyone can use it by:**
1. Opening the Vercel URL
2. Connecting MetaMask
3. Switching to Sepolia testnet
4. Using the app!

**Cross-Laptop Testing:**
- Laptop A: Open Vercel URL → Connect Wallet A → Register GPU
- Laptop B: Open SAME Vercel URL → Connect Wallet B → See GPU & Post Job
- Works perfectly! Same as localhost testing ✅

---

## 🔒 Security Notes

- No secrets in frontend code ✅
- Private keys stay in MetaMask ✅
- Smart contract addresses are public ✅
- No API keys needed ✅

---

## 📝 Custom Domain (Optional)

After deployment on Vercel:
1. Go to Project Settings → Domains
2. Add your custom domain: `broccobyte.com`
3. Update DNS records (Vercel shows instructions)
4. SSL certificate added automatically

---

## 🐛 Troubleshooting

**Build Fails?**
```bash
cd frontend
npm install
npm run build
# If this works locally, Vercel will work too
```

**MetaMask Not Connecting?**
- Make sure user is on Sepolia testnet
- Clear browser cache
- Try different browser

**GPUs Not Showing?**
- Check wallet is connected
- Verify on correct network (Sepolia)
- Check contract addresses in code

---

## 🎯 What Works on Vercel

✅ Register GPUs
✅ Browse available GPUs
✅ Post jobs with auto-calculated payment
✅ Claim jobs
✅ Complete jobs & receive payment
✅ Real-time notifications
✅ Cross-wallet sync
✅ Search/filter GPUs
✅ Statistics dashboard
✅ Everything that works on localhost!

---

Enjoy your deployed BroccoByte platform! 🥦
