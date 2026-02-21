# CertBot Website (Frontend)

Beautiful feedback form that automatically sends certificates to participants.

## Features

- ✅ Clean, modern UI with Tailwind CSS
- ✅ Real-time form validation with Zod
- ✅ Interactive star rating
- ✅ Character counters
- ✅ Success screen with confetti animation
- ✅ Responsive design (mobile-first)
- ✅ URL parameter for event name
- ✅ Error handling with user-friendly messages

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Backend URL

Edit `.env` file:

```env
# For local development
VITE_API_URL=http://localhost:3000

# For production (after deploying backend)
# VITE_API_URL=https://certbot.onrender.com
```

### 3. Run Development Server

```bash
npm run dev
```

Website will open at: `http://localhost:5173`

### 4. Test the Form

Open in browser with event parameter:

```
http://localhost:5173?event=Test%20Event%202026
```

Or without encoding:
```
http://localhost:5173?event=Test Event 2026
```

## Project Structure

```
certbot-website/
├── src/
│   ├── components/
│   │   ├── FeedbackForm.jsx      # Main form component
│   │   ├── StarRating.jsx        # Interactive star rating
│   │   └── SuccessMessage.jsx    # Success screen with confetti
│   ├── lib/
│   │   ├── validation.js         # Zod schemas
│   │   └── api.js                # API helper functions
│   ├── App.jsx                   # Main app component
│   ├── main.jsx                  # Entry point
│   └── index.css                 # Tailwind styles
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── .env
```

## Build for Production

```bash
npm run build
```

This creates a `dist/` folder with optimized production files.

## Deployment to Vercel

### Method 1: Via Dashboard

1. Push code to GitHub
2. Go to https://vercel.com
3. Click "New Project"
4. Import your GitHub repo `certbot-website`
5. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `./`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
6. Add Environment Variable:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://certbot.onrender.com` (your backend URL)
7. Click "Deploy"

### Method 2: Via CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Follow prompts and deploy
```

Your URL will be: `https://certbot-website.vercel.app` (or similar)

## Environment Variables

### Development
```env
VITE_API_URL=http://localhost:3000
```

### Production
```env
VITE_API_URL=https://certbot.onrender.com
```

## URL Structure

The form requires an `event` URL parameter:

```
https://certbot-website.vercel.app?event=AI%20Workshop%202026
```

Or readable format:
```
https://certbot-website.vercel.app?event=AI Workshop 2026
```

The browser will automatically encode spaces as `%20`.

## Form Fields

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Full Name | Text | Yes | 2-100 chars, letters only |
| Email | Email | Yes | Valid email format |
| Rating | Stars | Yes | 1-5 stars |
| Feedback | Textarea | Yes | 10-500 chars |
| Enjoyed Most | Textarea | No | Max 300 chars |
| Suggestions | Textarea | No | Max 300 chars |

## Testing

### Test Form Validation

1. Try submitting with empty fields → See validation errors
2. Enter invalid email → See email error
3. Enter <10 chars feedback → See length error
4. Don't select rating → See rating error

### Test Success Flow

1. Fill valid data
2. Submit form
3. Should see confetti animation
4. Check email for certificate

### Test Error Handling

1. Stop backend server
2. Submit form
3. Should see connection error message

## Customization

### Change Colors

Edit `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      primary: {
        DEFAULT: '#6366f1',  // Change this
        dark: '#4f46e5',      // And this
      }
    }
  }
}
```

### Change Fonts

Edit `index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=YourFont:wght@400;700&display=swap" rel="stylesheet">
```

Then in `tailwind.config.js`:

```js
fontFamily: {
  sans: ['YourFont', 'system-ui', 'sans-serif'],
}
```

### Change Event Name Display

The event name comes from the URL parameter. No code changes needed!

## Troubleshooting

### "Invalid event URL" error
- Check URL has `?event=` parameter
- Example: `?event=My Event Name`

### Form not submitting
- Check backend is running
- Verify `VITE_API_URL` in `.env`
- Check browser console for errors

### CORS errors
- Make sure backend has CORS enabled
- Backend should allow your frontend URL

### Styling issues
- Run `npm install` again
- Check Tailwind CSS is configured
- Clear browser cache

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

## License

MIT
"# CertBot2" 
