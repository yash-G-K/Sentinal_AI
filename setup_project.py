import os

project_root = "Sentinel-AI"

directories = [
    "backend/app",
    "backend/config",
    "backend/database",
    "backend/middleware",
    "backend/detectors",
    "backend/behavior",
    "backend/decision",
    "backend/reputation",
    "backend/firewall",
    "backend/ai",
    "backend/agent",
    "backend/websocket",
    "backend/scheduler",
    "backend/logging_service",
    "backend/routes",
    "backend/services",
    "backend/schemas",
    "backend/models",
    "backend/utils",
    "backend/tests",
    "nginx/ssl",
    "mysql",
    "docs",
    "docker",
    "scripts",
    "attack_simulator"
]

files = [
    "backend/database/connection.py",
    "backend/database/base.py",
    "backend/database/session.py",
    "backend/database/__init__.py",
    "backend/main.py",
    "backend/requirements.txt",
    "backend/.env.example",
    "nginx/nginx.conf",
    "mysql/schema.sql",
    "mysql/seed.sql",
    "docs/Architecture.md",
    "docs/API.md",
    "docs/Database.md",
    "docs/Workflow.md",
    "README.md",
    ".gitignore",
    "docker-compose.yml"
]

for d in directories:
    os.makedirs(os.path.join(project_root, d), exist_ok=True)

for f in files:
    with open(os.path.join(project_root, f), "w") as file:
        file.write("")

print("Directories and files created successfully.")
