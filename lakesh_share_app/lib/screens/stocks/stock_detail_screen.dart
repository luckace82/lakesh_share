import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';

import '../../services/api_client.dart';
import '../../utils/app_theme.dart';

class StockDetailScreen extends StatefulWidget {
  final String symbol;
  const StockDetailScreen({super.key, required this.symbol});

  @override
  State<StockDetailScreen> createState() => _StockDetailScreenState();
}

class _StockDetailScreenState extends State<StockDetailScreen> {
  final _api = ApiClient();
  Map<String, dynamic>? _stock;
  List<dynamic> _history = [];
  bool _loading = true;
  String? _error;
  int _selectedDays = 90;
  bool _inWatchlist = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        _api.getStockDetail(widget.symbol),
        _api.getStockHistory(widget.symbol, days: _selectedDays),
        _api.getWatchlist(),
      ]);
      final watchlist = List<dynamic>.from(results[2].data);
      setState(() {
        _stock = Map<String, dynamic>.from(results[0].data);
        _history = List<dynamic>.from(results[1].data);
        _inWatchlist = watchlist.any((w) => w['stock']?['symbol'] == widget.symbol || w['symbol'] == widget.symbol);
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = 'Failed to load ${widget.symbol}'; _loading = false; });
    }
  }

  Future<void> _toggleWatchlist() async {
    try {
      if (_inWatchlist) {
        await _api.removeFromWatchlist(widget.symbol);
      } else {
        await _api.addToWatchlist(widget.symbol);
      }
      setState(() => _inWatchlist = !_inWatchlist);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(_inWatchlist ? 'Added to watchlist' : 'Removed from watchlist'),
          backgroundColor: AppTheme.brand,
        ));
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.symbol),
        actions: [
          if (_stock != null)
            IconButton(
              icon: Icon(_inWatchlist ? Icons.bookmark : Icons.bookmark_border,
                  color: _inWatchlist ? AppTheme.brand : null),
              onPressed: _toggleWatchlist,
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text(_error!, style: const TextStyle(color: AppTheme.secondaryText)),
                  const SizedBox(height: 12),
                  ElevatedButton(onPressed: _loadData, child: const Text('Retry')),
                ]))
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _StockHeader(stock: _stock!),
                      const SizedBox(height: 16),
                      _RangeSelector(
                        selected: _selectedDays,
                        onChanged: (d) { setState(() => _selectedDays = d); _loadData(); },
                      ),
                      const SizedBox(height: 8),
                      if (_history.isNotEmpty) _PriceChart(history: _history),
                      const SizedBox(height: 16),
                      _StockMetrics(stock: _stock!),
                    ],
                  ),
                ),
    );
  }
}

class _StockHeader extends StatelessWidget {
  final Map<String, dynamic> stock;
  const _StockHeader({required this.stock});

  @override
  Widget build(BuildContext context) {
    final live = stock['live_price'];
    final ltp = live?['ltp'] ?? stock['last_price'];
    final changePct = live?['change_percent'] ?? 0.0;
    final isUp = (changePct as num) >= 0;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(stock['name'] ?? stock['symbol'],
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.primaryText)),
          if (stock['sector'] != null && (stock['sector'] as String).isNotEmpty)
            Text(stock['sector'], style: const TextStyle(color: AppTheme.secondaryText, fontSize: 12)),
          const SizedBox(height: 12),
          Row(children: [
            Text(
              ltp != null ? 'NPR ${NumberFormat('#,##0.00').format((ltp as num).toDouble())}' : '--',
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: AppTheme.primaryText),
            ),
            const SizedBox(width: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: (isUp ? AppTheme.gain : AppTheme.loss).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                '${isUp ? '+' : ''}${changePct.toStringAsFixed(2)}%',
                style: TextStyle(color: isUp ? AppTheme.gain : AppTheme.loss, fontWeight: FontWeight.w600),
              ),
            ),
          ]),
        ]),
      ),
    );
  }
}

class _RangeSelector extends StatelessWidget {
  final int selected;
  final ValueChanged<int> onChanged;
  const _RangeSelector({required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    const options = [30, 90, 180, 365];
    const labels = ['1M', '3M', '6M', '1Y'];
    return Row(
      children: List.generate(options.length, (i) {
        final active = selected == options[i];
        return Padding(
          padding: const EdgeInsets.only(right: 8),
          child: ChoiceChip(
            label: Text(labels[i]),
            selected: active,
            onSelected: (_) => onChanged(options[i]),
            selectedColor: AppTheme.brand,
            backgroundColor: AppTheme.cardBg,
            labelStyle: TextStyle(color: active ? Colors.white : AppTheme.secondaryText),
          ),
        );
      }),
    );
  }
}

class _PriceChart extends StatelessWidget {
  final List<dynamic> history;
  const _PriceChart({required this.history});

  @override
  Widget build(BuildContext context) {
    final spots = <FlSpot>[];
    for (int i = 0; i < history.length; i++) {
      final close = (history[i]['close'] ?? 0) as num;
      spots.add(FlSpot(i.toDouble(), close.toDouble()));
    }
    final minY = spots.map((s) => s.y).reduce((a, b) => a < b ? a : b) * 0.99;
    final maxY = spots.map((s) => s.y).reduce((a, b) => a > b ? a : b) * 1.01;
    final isUp = spots.last.y >= spots.first.y;

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 16, 12, 8),
        child: SizedBox(
          height: 180,
          child: LineChart(LineChartData(
            minY: minY,
            maxY: maxY,
            gridData: FlGridData(
              show: true,
              drawVerticalLine: false,
              getDrawingHorizontalLine: (_) => const FlLine(color: AppTheme.border, strokeWidth: 0.5),
            ),
            borderData: FlBorderData(show: false),
            titlesData: FlTitlesData(
              topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              bottomTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              leftTitles: AxisTitles(sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 48,
                getTitlesWidget: (val, _) => Text(
                  NumberFormat('#,##0').format(val),
                  style: const TextStyle(fontSize: 9, color: AppTheme.secondaryText),
                ),
              )),
            ),
            lineBarsData: [
              LineChartBarData(
                spots: spots,
                isCurved: true,
                color: isUp ? AppTheme.gain : AppTheme.loss,
                barWidth: 2,
                dotData: const FlDotData(show: false),
                belowBarData: BarAreaData(
                  show: true,
                  color: (isUp ? AppTheme.gain : AppTheme.loss).withValues(alpha: 0.08),
                ),
              ),
            ],
          )),
        ),
      ),
    );
  }
}

class _StockMetrics extends StatelessWidget {
  final Map<String, dynamic> stock;
  const _StockMetrics({required this.stock});

  @override
  Widget build(BuildContext context) {
    final live = stock['live_price'] ?? {};
    final metrics = <String, String>{
      'Open': _fmt(live['open']),
      'High': _fmt(live['high']),
      'Low': _fmt(live['low']),
      'Volume': live['volume'] != null ? NumberFormat('#,##0').format(live['volume']) : '--',
      'RSI (14)': stock['rsi_14'] != null ? (stock['rsi_14'] as num).toStringAsFixed(1) : '--',
      'MA (20)': _fmt(stock['ma_20']),
    };

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Key Metrics', style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryText)),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: 3,
              children: metrics.entries.map((e) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(e.key, style: const TextStyle(fontSize: 11, color: AppTheme.secondaryText)),
                  Text(e.value, style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.primaryText)),
                ],
              )).toList(),
            ),
          ],
        ),
      ),
    );
  }

  String _fmt(dynamic val) {
    if (val == null) return '--';
    return 'NPR ${NumberFormat('#,##0.00').format((val as num).toDouble())}';
  }
}
