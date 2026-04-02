# RNAPeaks Webapp

A web application for the RNAPeaks Package

## Structure

- `frontend/` — Next.js application
- `backend/` — API server

## Architecture
### Big Picture
- User Browser -> (Via HTTPS) Vercel (Next.js Frontend & APIs) -> Hugging Face Spaces(nginx[reverse proxy] -> plumber R workers)
- Browser is the client, Renders the UI (HTML), Stores session token in sessionStorage(Tab Memory), Make's http api req to /api on Vercel
- Vercel Server:
    - Job A: Servers the Frontend, sends HTML, CSS, JS to webbrowswer, 
    - Job B: API Proxy, nextjs server call's the plumber worker API's from the input requests it gets from webbrowser
        - Read X-Session Token
        - Validates the HMAC Signature using Session Secret
- Layer 3:
 - NGINX:
    - Reverse Proxy, Requests arrive at NGINX and it processes before sending to R workers
    - does 2 worker load balancing
    - Rate Limiting: Tracks requests each session has made
    


## Development

See `frontend/README.md` for setup instructions.