from fastapi import Request, FastAPI
from fastapi.responses import JSONResponse
from loguru import logger

class SentinelException(Exception):
    """Base exception for Sentinel AI"""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code

def setup_exception_handlers(app: FastAPI):
    @app.exception_handler(SentinelException)
    async def sentinel_exception_handler(request: Request, exc: SentinelException):
        logger.warning(f"SentinelException: {exc.message}")
        return JSONResponse(
            status_code=exc.status_code,
            content={"message": exc.message}
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception on {request.url.path}: {str(exc)}")
        return JSONResponse(
            status_code=500,
            content={"message": "Internal Server Error"}
        )
