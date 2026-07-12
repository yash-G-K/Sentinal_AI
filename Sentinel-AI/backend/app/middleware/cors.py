from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

def setup_cors(app: FastAPI):
    """Configures Cross-Origin Resource Sharing (CORS)."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"], # In production, this should be restricted
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
