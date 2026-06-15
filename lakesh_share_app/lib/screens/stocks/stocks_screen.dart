import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../services/api_client.dart';
import '../../utils/app_theme.dart';

class StocksScreen extends StatefulWidget {
  const StocksScreen({super.key});

  @override
  State<StocksScreen> createState() => _StocksScreenState();
}

class _StocksScreenState extends State<StocksScreen> {
  final _api = ApiClient();
  final _searchCtrl = TextEditingController();
  List<dynamic> _stocks = [];
  bool _loading = true;
  String? _error;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _loadStocks();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadStocks() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await _api.getKnownStocks(search: _search.isEmpty ? null : _search);
      setState(() {
        _stocks = List<dynamic>.from(res.data);
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = 'Failed to load stocks'; _loading = false; });
    }
  }

  void _onSearch(String val) {
    _search = val;
    _loadStocks();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Stocks'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              onChanged: _onSearch,
              decoration: const InputDecoration(
                hintText: 'Search stocks...',
                prefixIcon: Icon(Icons.search),
                isDense: true,
              ),
            ),
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text(_error!, style: const TextStyle(color: AppTheme.secondaryText)),
                  const SizedBox(height: 12),
                  ElevatedButton(onPressed: _loadStocks, child: const Text('Retry')),
                ]))
              : RefreshIndicator(
                  onRefresh: _loadStocks,
                  child: ListView.separated(
                    itemCount: _stocks.length,
                    separatorBuilder: (_, __) => const Divider(height: 1, color: AppTheme.border),
                    itemBuilder: (context, i) {
                      final stock = _stocks[i];
                      return ListTile(
                        onTap: () => context.go('/stocks/${stock['symbol']}'),
                        title: Text(stock['symbol'] ?? '',
                            style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryText)),
                        subtitle: Text(stock['name'] ?? '', style: const TextStyle(color: AppTheme.secondaryText, fontSize: 12)),
                        trailing: stock['sector'] != null && (stock['sector'] as String).isNotEmpty
                            ? Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: AppTheme.brand.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(stock['sector'],
                                    style: const TextStyle(fontSize: 10, color: AppTheme.brand)),
                              )
                            : const Icon(Icons.chevron_right, color: AppTheme.secondaryText),
                      );
                    },
                  ),
                ),
    );
  }
}
