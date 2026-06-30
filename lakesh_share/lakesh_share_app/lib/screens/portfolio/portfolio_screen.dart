import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../services/api_client.dart';
import '../../utils/app_theme.dart';

class PortfolioScreen extends StatefulWidget {
  const PortfolioScreen({super.key});

  @override
  State<PortfolioScreen> createState() => _PortfolioScreenState();
}

class _PortfolioScreenState extends State<PortfolioScreen> {
  final _api = ApiClient();
  List<dynamic> _holdings = [];
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
      final res = await _api.getPortfolio();
      setState(() { _holdings = List<dynamic>.from(res.data); _loading = false; });
    } catch (_) {
      setState(() { _error = 'Failed to load portfolio'; _loading = false; });
    }
  }

  double get _totalInvested => _holdings.fold(0, (sum, h) => sum + ((h['total_invested'] ?? 0) as num).toDouble());
  double get _totalCurrent {
    return _holdings.fold(0.0, (sum, h) {
      final qty = (h['quantity'] ?? 0) as num;
      final live = h['stock']?['live_price'];
      final price = live?['ltp'] ?? h['buy_price'] ?? 0;
      return sum + qty.toDouble() * (price as num).toDouble();
    });
  }

  Future<void> _showAddDialog() async {
    final symbolCtrl = TextEditingController();
    final qtyCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.cardBg,
        title: const Text('Add Holding', style: TextStyle(color: AppTheme.primaryText)),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: symbolCtrl, textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(hintText: 'Symbol (e.g. NABIL)')),
          const SizedBox(height: 10),
          TextField(controller: qtyCtrl, keyboardType: TextInputType.number,
              decoration: const InputDecoration(hintText: 'Quantity')),
          const SizedBox(height: 10),
          TextField(controller: priceCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(hintText: 'Buy price (NPR)')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              final sym = symbolCtrl.text.trim().toUpperCase();
              final qty = int.tryParse(qtyCtrl.text.trim());
              final price = double.tryParse(priceCtrl.text.trim());
              if (sym.isEmpty || qty == null || price == null) return;
              Navigator.pop(ctx);
              try {
                await _api.addToPortfolio({'stock_symbol': sym, 'quantity': qty, 'buy_price': price});
                _load();
              } catch (_) {
                if (mounted) ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Failed to add holding'), backgroundColor: AppTheme.loss),
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
    final totalPL = _totalCurrent - _totalInvested;
    final totalPLPct = _totalInvested > 0 ? (totalPL / _totalInvested * 100) : 0.0;
    final isUp = totalPL >= 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Portfolio'),
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
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_holdings.isNotEmpty) ...[
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              const Text('Portfolio Summary', style: TextStyle(color: AppTheme.secondaryText, fontSize: 12)),
                              const SizedBox(height: 8),
                              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  const Text('Invested', style: TextStyle(color: AppTheme.secondaryText, fontSize: 11)),
                                  Text('NPR ${NumberFormat('#,##0.00').format(_totalInvested)}',
                                      style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryText)),
                                ]),
                                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                                  const Text('P/L', style: TextStyle(color: AppTheme.secondaryText, fontSize: 11)),
                                  Text(
                                    '${isUp ? '+' : ''}NPR ${NumberFormat('#,##0.00').format(totalPL)} (${totalPLPct.toStringAsFixed(2)}%)',
                                    style: TextStyle(fontWeight: FontWeight.bold, color: isUp ? AppTheme.gain : AppTheme.loss),
                                  ),
                                ]),
                              ]),
                            ]),
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],
                      if (_holdings.isEmpty)
                        Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                          const SizedBox(height: 60),
                          const Icon(Icons.account_balance_wallet_outlined, size: 56, color: AppTheme.secondaryText),
                          const SizedBox(height: 12),
                          const Text('No holdings yet', style: TextStyle(color: AppTheme.secondaryText)),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            onPressed: _showAddDialog,
                            icon: const Icon(Icons.add),
                            label: const Text('Add Holding'),
                          ),
                        ]))
                      else
                        ..._holdings.map((h) {
                          final stock = h['stock'] ?? {};
                          final symbol = stock['symbol'] ?? '';
                          final qty = (h['quantity'] ?? 0) as num;
                          final buyPrice = (h['buy_price'] ?? 0) as num;
                          final live = stock['live_price'];
                          final ltp = (live?['ltp'] ?? buyPrice) as num;
                          final pl = (ltp - buyPrice).toDouble() * qty.toDouble();
                          final plPct = buyPrice > 0 ? (pl / (buyPrice.toDouble() * qty.toDouble()) * 100) : 0.0;
                          final up = pl >= 0;

                          return Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: ListTile(
                              onTap: () => context.go('/stocks/$symbol'),
                              title: Text(symbol, style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryText)),
                              subtitle: Text('${qty.toInt()} shares @ NPR ${buyPrice.toStringAsFixed(2)}',
                                  style: const TextStyle(color: AppTheme.secondaryText, fontSize: 12)),
                              trailing: Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
                                Text('NPR ${NumberFormat('#,##0.00').format(ltp.toDouble())}',
                                    style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.primaryText)),
                                Text(
                                  '${up ? '+' : ''}${plPct.toStringAsFixed(2)}%',
                                  style: TextStyle(fontSize: 12, color: up ? AppTheme.gain : AppTheme.loss),
                                ),
                              ]),
                            ),
                          );
                        }),
                    ],
                  ),
                ),
    );
  }
}
