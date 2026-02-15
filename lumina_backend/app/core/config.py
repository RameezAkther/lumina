import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "Lumina"
    MONGO_URL: str = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    DB_NAME: str = os.getenv("DB_NAME", "lumina_db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "satoru_gojo")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 360
    # default pool of profile pictures (can be customized via env if desired)
    PROFILE_PICS: list[str] = [
        "https://i.pinimg.com/736x/ea/c3/f4/eac3f4bcb400cb4b4f865769f8e3fb2a.jpg",
        "https://i.pinimg.com/736x/08/c4/7f/08c47fc9ec057c8df221ff7ef6b534b1.jpg",
        "https://i.pinimg.com/736x/5a/d0/13/5ad013e61069c4f2c72ad5505f707936.jpg",
        "https://i.pinimg.com/736x/b5/d8/0c/b5d80c7a12e9aba27ce162968fd9b65b.jpg",
        "https://i.pinimg.com/736x/c8/75/e8/c875e804de858dd2ea4304df7ffe8195.jpg",
    ]
    UPLOAD_DIR: str = os.path.join(os.getcwd(), "user_data")

settings = Settings()
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)