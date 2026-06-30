import 'package:dio/dio.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  static ApiClient? _instance;
  late final Dio _dio;
  final _storage = const FlutterSecureStorage();

  ApiClient._() {
    final baseUrl = dotenv.env['API_BASE_URL'] ?? 'http://10.0.2.2:8000/api';
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'access_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (err, handler) async {
        if (err.response?.statusCode == 401) {
          final refreshed = await _tryRefresh();
          if (refreshed) {
            final token = await _storage.read(key: 'access_token');
            final opts = err.requestOptions;
            opts.headers['Authorization'] = 'Bearer $token';
            try {
              final retry = await _dio.fetch(opts);
              return handler.resolve(retry);
            } catch (e) {
              return handler.next(err);
            }
          }
        }
        return handler.next(err);
      },
    ));
  }

  factory ApiClient() {
    _instance ??= ApiClient._();
    return _instance!;
  }

  Future<bool> _tryRefresh() async {
    final refresh = await _storage.read(key: 'refresh_token');
    if (refresh == null) return false;
    try {
      final baseUrl = dotenv.env['API_BASE_URL'] ?? 'http://10.0.2.2:8000/api';
      final res = await Dio().post('$baseUrl/auth/refresh/', data: {'refresh': refresh});
      await _storage.write(key: 'access_token', value: res.data['access']);
      return true;
    } catch (_) {
      await _storage.deleteAll();
      return false;
    }
  }

  Dio get dio => _dio;

  // ── Auth ──────────────────────────────────────────────────────────────────
  Future<Response> login(String username, String password) =>
      _dio.post('/auth/login/', data: {'username': username, 'password': password});

  Future<Response> register(String username, String email, String password) =>
      _dio.post('/auth/register/', data: {'username': username, 'email': email, 'password': password});

  Future<Response> getMe() => _dio.get('/auth/me/');

  // ── Stocks ────────────────────────────────────────────────────────────────
  Future<Response> getStocks({String? search, String? sector}) =>
      _dio.get('/stocks/', queryParameters: {
        if (search != null && search.isNotEmpty) 'search': search,
        if (sector != null && sector.isNotEmpty) 'sector': sector,
      });

  Future<Response> getKnownStocks({String? search}) =>
      _dio.get('/stocks/known/', queryParameters: {
        if (search != null && search.isNotEmpty) 'search': search,
      });

  Future<Response> getStockDetail(String symbol) =>
      _dio.get('/stocks/$symbol/');

  Future<Response> getStockHistory(String symbol, {int? days}) =>
      _dio.get('/stocks/$symbol/history/', queryParameters: {
        if (days != null) 'days': days,
      });

  Future<Response> getStockLive(String symbol) =>
      _dio.get('/stocks/$symbol/live/');

  Future<Response> getAllStocksWithPrices() =>
      _dio.get('/stocks/all/');

  // ── Watchlist ──────────────────────────────────────────────────────────────
  Future<Response> getWatchlist() => _dio.get('/watchlist/');

  Future<Response> addToWatchlist(String symbol) =>
      _dio.post('/watchlist/', data: {'stock_symbol': symbol});

  Future<Response> removeFromWatchlist(String symbol) =>
      _dio.delete('/watchlist/$symbol/');

  Future<Response> autoScrapeWatchlist() =>
      _dio.post('/watchlist/auto-scrape/');

  // ── Portfolio ──────────────────────────────────────────────────────────────
  Future<Response> getPortfolio() => _dio.get('/portfolio/');

  Future<Response> addToPortfolio(Map<String, dynamic> data) =>
      _dio.post('/portfolio/', data: data);

  Future<Response> removeFromPortfolio(int id) =>
      _dio.delete('/portfolio/$id/');

  Future<Response> getPortfolioTransactions(String symbol) =>
      _dio.get('/portfolio/$symbol/transactions/');

  // ── NEPSE Index ───────────────────────────────────────────────────────────
  Future<Response> getNepseIndex({String? range}) =>
      _dio.get('/nepse-index/', queryParameters: {
        if (range != null) 'range': range,
      });

  Future<Response> getMarketStats() => _dio.get('/market-stats/');

  Future<Response> getNepseInsights({String? range}) =>
      _dio.get('/nepse-index/insights/', queryParameters: {
        if (range != null) 'range': range,
      });

  // ── AI / Chat ─────────────────────────────────────────────────────────────
  Future<Response> chatQuery(String query) =>
      _dio.post('/chat/query/', data: {'query': query});

  Future<Response> analyzeStock(String symbol, String message) =>
      _dio.post('/ai/analyze/', data: {'symbol': symbol, 'message': message});

  Future<Response> analyzePortfolio() =>
      _dio.post('/ai/analyze/', data: {'type': 'portfolio'});

  // ── Screener ──────────────────────────────────────────────────────────────
  Future<Response> screener({Map<String, dynamic>? params}) =>
      _dio.get('/screener/', queryParameters: params);
}
