# Lakesh Share - NEPSE Stock Market Application

A comprehensive stock market analysis and tracking application for Nepal Stock Exchange (NEPSE) with real-time data scraping, AI-powered analysis, and portfolio management.

## Features

- **Real-time Stock Data**: Live stock prices and historical data from NEPSE
- **Portfolio Management**: Track your stock portfolio with profit/loss calculations
- **Watchlist**: Create and monitor custom watchlists
- **AI Analysis**: Get AI-powered stock recommendations and market insights
- **NEPSE Index Tracking**: Monitor NEPSE index with predictions and insights
- **Stock Screener**: AI-powered stock screening based on technical indicators
- **User Authentication**: Secure JWT-based authentication system
- **Responsive Frontend**: Modern React frontend with Tailwind CSS

## Tech Stack

### Backend
- **Django 6.0** - Web framework
- **Django REST Framework** - API development
- **PostgreSQL** - Database
- **Celery** - Background task processing
- **Redis** - Message broker and caching
- **Selenium** - Web scraping
- **BeautifulSoup** - HTML parsing

### Frontend
- **React 18** - Frontend framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **Lucide React** - Icons

## Setup Instructions

### Prerequisites

- Python 3.8+
- Node.js 16+
- PostgreSQL
- Redis
- Chrome browser (for Selenium)

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lakesh_share
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Database setup**
   ```bash
   # Create PostgreSQL database
   createdb lakesh_share
   
   # Run migrations
   python manage.py migrate
   ```

5. **Create environment file**
   ```bash
   cp .env.example .env
   ```
   
   Configure `.env` with your settings:
   ```env
   SECRET_KEY=your-secret-key
   DEBUG=True
   DB_NAME=lakesh_share
   DB_USER=your-db-user
   DB_PASSWORD=your-db-password
   DB_HOST=localhost
   DB_PORT=5432
   CELERY_BROKER_URL=redis://localhost:6379/0
   CELERY_RESULT_BACKEND=redis://localhost:6379/0
   OLLAMA_BASE_URL=http://localhost:11434
   ```

6. **Start services**
   ```bash
   # Start PostgreSQL
   sudo systemctl start postgresql
   
   # Start Redis
   sudo systemctl start redis
   
   # Start Django development server
   python manage.py runserver 0.0.0.0:8000
   ```

7. **Start Celery worker** (in separate terminal)
   ```bash
   source venv/bin/activate
   celery -A lakesh_share worker -l info
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API URL**
   - Update `src/api/client.js` to point to your backend URL
   - Default: `http://localhost:8000/api`

4. **Start development server**
   ```bash
   npm run dev
   ```

## Network Access Configuration

### For Development on Multiple Devices

1. **Backend Configuration**
   - Add your network IP to `ALLOWED_HOSTS` in `lakesh_share/settings.py`
   - Example: `ALLOWED_HOSTS = ['localhost', '127.0.0.1', '192.168.1.14']`

2. **Frontend Configuration**
   - Configure Vite to accept network connections in `vite.config.js`
   - Add `host: '0.0.0.0'` to server configuration

3. **CORS Configuration**
   - Add your network IP to `CORS_ALLOWED_ORIGINS` in settings
   - Example: `'http://192.168.1.14:5173'`

4. **Access URLs**
   - Frontend: `http://YOUR_IP:5173/`
   - Backend API: `http://YOUR_IP:8000/api/`

## API Endpoints

### Authentication
- `POST /api/auth/register/` - User registration
- `POST /api/auth/login/` - User login
- `POST /api/auth/refresh/` - Refresh JWT token
- `GET /api/auth/me/` - Get current user info

### Stocks
- `GET /api/stocks/` - List all stocks
- `GET /api/stocks/{symbol}/` - Get stock details
- `GET /api/stocks/{symbol}/history/` - Get historical data
- `GET /api/stocks/{symbol}/live/` - Get live price

### Watchlist
- `GET /api/watchlist/` - Get user watchlist
- `POST /api/watchlist/` - Add stock to watchlist
- `DELETE /api/watchlist/{symbol}/` - Remove from watchlist

### Portfolio
- `GET /api/portfolio/` - Get user portfolio
- `POST /api/portfolio/` - Add to portfolio
- `DELETE /api/portfolio/{id}/` - Remove from portfolio

### AI Analysis
- `POST /api/ai/analyze/` - AI stock analysis
- `POST /api/screener/auto/` - AI stock screening

### NEPSE Index
- `GET /api/nepse-index/` - Get NEPSE index data
- `GET /api/nepse-index/predictions/` - Get index predictions

## Usage

1. **Register an account** at `http://localhost:5173/register`
2. **Login** with your credentials
3. **Add stocks** to your watchlist
4. **Create portfolio** to track your investments
5. **Use AI analysis** for stock recommendations
6. **Monitor NEPSE index** for market trends

## Background Tasks

The application uses Celery for background tasks:

- **Stock Scraping**: Automatically scrapes stock data from NEPSE
- **AI Analysis**: Processes AI-powered stock analysis
- **Index Updates**: Updates NEPSE index data
- **Data Cleanup**: Cleans up old data

To run Celery worker:
```bash
celery -A lakesh_share worker -l info
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Django secret key | Required |
| `DEBUG` | Debug mode | `True` |
| `DB_NAME` | Database name | Required |
| `DB_USER` | Database user | Required |
| `DB_PASSWORD` | Database password | Required |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `CELERY_BROKER_URL` | Redis broker URL | `redis://localhost:6379/0` |
| `OLLAMA_BASE_URL` | Ollama API URL | `http://localhost:11434` |

## Troubleshooting

### Common Issues

1. **PostgreSQL Connection Error**
   - Ensure PostgreSQL is running: `sudo systemctl start postgresql`
   - Check database credentials in `.env`

2. **Redis Connection Error**
   - Ensure Redis is running: `sudo systemctl start redis`
   - Check Redis configuration

3. **Selenium WebDriver Issues**
   - Install Chrome browser
   - Update webdriver-manager: `pip install --upgrade webdriver-manager`

4. **CORS Errors**
   - Add frontend URL to `CORS_ALLOWED_ORIGINS` in settings
   - Check API base URL in frontend client

5. **Network Access Issues**
   - Add your IP to `ALLOWED_HOSTS`
   - Configure firewall to allow ports 8000 and 5173

## Development

### Running Tests
```bash
python manage.py test
```

### Database Migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

### Creating Superuser
```bash
python manage.py createsuperuser
```

## License

This project is licensed under the MIT License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Support

For issues and questions, please create an issue in the repository.
