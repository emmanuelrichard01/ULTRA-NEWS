FROM node:20-alpine

WORKDIR /app

# We expect package.json to actally exist in the future, 
# but for the very first build, we might need to be lenient or manual.
# This is a dev dockerfile.

COPY package*.json ./

RUN if [ -f package.json ]; then npm install; else echo "No package.json found, skipping install"; fi

COPY . .

CMD ["npm", "run", "dev"]
