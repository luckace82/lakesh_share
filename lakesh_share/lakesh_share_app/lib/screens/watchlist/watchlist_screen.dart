import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../services/api_client.dart';
import '../../utils/app_theme.dart';

class WatchlistScreen extends StatefulWidget {
  const WatchlistScreen({super.key});

  @override
  State<WatchlistScreen> createState() => _WatchlistScreenState();
}

class _WatchlistScreenState extends State<WatchlistScreen> {
  final _api = ApiClient();
  List<dynamic> _watchlist = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await _api.getWatchlist();
      setState(() { _watchlist = List<dynamic>.from(res.data); _loading = false; });
    } catch (_) {
      setState(() { _error = 'Failed to load watchlist'; _loading = false; });
    }
  }

  Future<void> _remove(String symbol) async {
    try {
      await _api.removeFromWatchlist(symbol);
      setState(() => _watchlist.removeWhere((w) => (w['stock']?['symbol'] ?? w['symbol']) == symbol));
    } catch (_) {}
  }

  Future<void> _showAddDialog() async {
    final ctrl = TextEditingController();
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.cardBg,
        title: const Text('Add to Watchlist', style: TextStyle(color: AppTheme.primaryText)),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          textCapitalization: TextCapitalization.characters,
          decoration: const InputDecoration(hintText: 'Stock symbol (e.g. NABIL)'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              final sym = ctrl.text.trim().toUpperCase();
              if (sym.isEmpty) return;
              Navigator.pop(ctx);
              try {
                await _api.addToWatchlist(sym);
                _load();
              } catch (e) {
                if (mounted) ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Failed to add stock'), backgroundColor: AppTheme.loss),
                );
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Watchlist'),
        actions: [IconButton(icon: const Icon(Icons.add), onPressed: _showAddDialog)],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text(_error!, style: const TextStyle(color: AppTheme.secondaryText)),
                  const SizedBox(height: 12),
                  ElevatedButton(onPressed: _load, child: const Text('Retry')),
                ]))
              : _watchlist.isEmpty
                  ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.bookmark_border, size: 56, color: AppTheme.secondaryText),
                      const SizedBox(height: 12),
                      const Text('No stocks in watchlist', style: TextStyle(color: AppTheme.secondaryText)),
                      const SizedBox(height: 16),
                      ElevatedButton.icon(
                        onPressed: _showAddDialog,
                        icon: const Icon(Icons.add),
                        label: const Text('Add Stock'),
                      ),
                    ]))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        itemCount: _watchlist.length,
                        separatorBuilder: (_, __) => const Divider(height: 1, color: AppTheme.border),
                        itemBuilder: (context, i) {
                          final item = _watchlist[i];
                          final stock = item['stock'] ?? item;
                          final symbol = stock['symbol'] ?? '';
                          final name = stock['name'] ?? symbol;
                          final live = stock['live_price'];
                          final ltp = live?['ltp'];
                          final changePct = (live?['change_percent'] ?? 0.0) as num;
                          final isUp = changePct >= 0;

                          return ListTile(
                            onTap: () => context.go('/stocks/$symbol'),
                            title: Text(symbol, style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryText)),
                            subtitle: Text(name, style: const TextStyle(color: AppTheme.secondaryText, fontSize: 12)),
                            trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                              Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
                                Text(
                                  ltp != null ? 'NPR ${(ltp as num).toStringAsFixed(2)}' : '--',
                                  style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.primaryText),
                                ),
                                Text(
                                  '${isUp ? '+' : ''}${changePct.toStringAsFixed(2)}%',
                                  style: TextStyle(fontSize: 12, color: isUp ? AppTheme.gain : AppTheme.loss),
                                ),
                              ]),
                              const SizedBox(width: 8),
                              IconButton(
                                icon: const Icon(Icons.delete_outline, color: AppTheme.secondaryText, size: 20),
                                onPressed: () => _remove(symbol),
                              ),
                            ]),
                          );
                        },
                      ),
                    ),
    );
  }
}
