import os
import shutil

project_root = "c:/Users/ASUS/OneDrive/Desktop/Arithwise projects/AI_WAF/Sentinel-AI/backend"

directories = [
    "app/api",
    "app/config",
    "app/core",
    "app/database",
    "app/middleware",
    "app/models",
    "app/repositories",
    "app/schemas",
    "app/services",
    "app/detectors",
    "app/ai",
    "app/firewall",
    "app/reputation",
    "app/security",
    "app/utils",
    "app/logs",
    "tests",
    "alembic"
]

for d in directories:
    os.makedirs(os.path.join(project_root, d), exist_ok=True)

# Move models if they are in app/database/models to app/models
db_models_path = os.path.join(project_root, "app/database/models")
app_models_path = os.path.join(project_root, "app/models")

if os.path.exists(db_models_path):
    for filename in os.listdir(db_models_path):
        src = os.path.join(db_models_path, filename)
        dst = os.path.join(app_models_path, filename)
        shutil.move(src, dst)
    shutil.rmtree(db_models_path)

print("Backend directories restructured.")
