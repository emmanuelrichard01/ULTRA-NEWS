# 🗺️ Project Roadmap

## Phase 1: Foundation (Current Status)
- [ ] Initialize Monorepo structure (Backend/Frontend/Docker).
- [ ] Configure Docker Compose for Django + Postgres.
- [ ] Verify local development environment (`localhost:8000` & `localhost:3000`).

## Phase 2: The Backend Core
- [ ] **Data Modeling:** Create `Article` and `Category` models in Django.
- [ ] **API Setup:** Install Django Ninja and create the first "Health Check" endpoint.
- [ ] **Scraper Logic:** Port legacy scraping logic to a Service Object pattern (decoupled from Views).
- [ ] **Ingestion:** Create a management command to fetch news and save to DB.

## Phase 3: The Frontend Interface
- [ ] **UI Shell:** Setup Tailwind layout (Navbar, Footer, Responsive Grid).
- [ ] **Data Integration:** Fetch data from Django API using `fetch()` in Next.js.
- [ ] **Article Card:** Create a reusable component for displaying news items.

## Phase 4: Polish & Production
- [ ] **Optimization:** Implement caching (Redis) for API responses.
- [ ] **Security:** CORS headers, Environment Variables validation.
- [ ] **Deployment:** Docker build optimization for production.
