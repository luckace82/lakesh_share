import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_client.dart';

class AuthService extends ChangeNotifier {
  final _storage = const FlutterSecureStorage();
  final _api = ApiClient();

  bool _isAuthenticated = false;
  Map<String, dynamic>? _user;
  String? _error;

  bool get isAuthenticated => _isAuthenticated;
  Map<String, dynamic>? get user => _user;
  String? get error => _error;

  Future<void> init() async {
    final token = await _storage.read(key: 'access_token');
    if (token != null) {
      try {
        final res = await _api.getMe();
        _user = Map<String, dynamic>.from(res.data);
        _isAuthenticated = true;
      } catch (_) {
        await _storage.deleteAll();
        _isAuthenticated = false;
      }
    }
    notifyListeners();
  }

  Future<bool> login(String username, String password) async {
    _error = null;
    try {
      final res = await _api.login(username, password);
      await _storage.write(key: 'access_token', value: res.data['access']);
      await _storage.write(key: 'refresh_token', value: res.data['refresh']);
      final me = await _api.getMe();
      _user = Map<String, dynamic>.from(me.data);
      _isAuthenticated = true;
      notifyListeners();
      return true;
    } catch (e) {
      _error = _parseError(e);
      notifyListeners();
      return false;
    }
  }

  Future<bool> register(String username, String email, String password) async {
    _error = null;
    try {
      await _api.register(username, email, password);
      return await login(username, password);
    } catch (e) {
      _error = _parseError(e);
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await _storage.deleteAll();
    _isAuthenticated = false;
    _user = null;
    notifyListeners();
  }

  String _parseError(dynamic e) {
    try {
      final data = (e as dynamic).response?.data;
      if (data is Map) {
        if (data.containsKey('detail')) return data['detail'];
        final first = data.values.first;
        if (first is List) return first.first.toString();
        return first.toString();
      }
    } catch (_) {}
    return 'Something went wrong. Please try again.';
  }
}
