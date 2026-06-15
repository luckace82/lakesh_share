import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';

import '../../services/api_client.dart';
import '../../services/auth_service.dart';
import '../../utils/app_theme.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _api = ApiClient();
  Map<String, dynamic>? _marketStats;
  List<dynamic> _nepseData = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        _api.getMarketStats(),
        _api.getNepseIndex(range: '30d'),
      ]);
      setState(() {
        _marketStats = Map<String, dynamic>.from(results[0].data);
        _nepseData = List<dynamic>.from(results[1].data is List ? results[1].data : []);
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = 'Failed to load market data'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().user;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Lakesh Share', style: TextStyle(fontWeight: FontWeight.bold)),
            if (user != null)
              Text('Welcome, ${user['username']}',
                  style: const TextStyle(fontSize: 12, color: AppTheme.secondaryText)),
          ],
        ),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadData),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => context.read<AuthService>().logout(),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _ErrorView(message: _error!, onRetry: _loadData)
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_marketStats != null) _MarketStatsRow(stats: _marketStats!),
                      const SizedBox(height: 16),
                      if (_nepseData.isNotEmpty) _NepseChart(data: _nepseData),
                      const SizedBox(height: 16),
                      _QuickActionsRow(),
                    ],
                  ),
                ),
    );
  }
}

class _MarketStatsRow extends StatelessWidget {
  final Map<String, dynamic> stats;
  const _MarketStatsRow({required this.stats});

  @override
  Widget build(BuildContext context) {
    final nepse = stats['nepse_index'];
    final change = (nepse?['change_percent'] ?? 0.0) as num;
    final isUp = change >= 0;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('NEPSE Index', style: TextStyle(color: AppTheme.secondaryText, fontSize: 12)),
            const SizedBox(height: 4),
            Row(
              children: [
                Text(
                  nepse?['value']?.toString() ?? '--',
                  style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: AppTheme.primaryText),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: (isUp ? AppTheme.gain : AppTheme.loss).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '${isUp ? '+' : ''}${change.toStringAsFixed(2)}%',
                    style: TextStyle(color: isUp ? AppTheme.gain : AppTheme.loss, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _StatItem(label: 'Turnover', value: _formatCurrency(stats['total_turnover'])),
                _StatItem(label: 'Gainers', value: stats['gainers']?.toString() ?? '--', color: AppTheme.gain),
                _StatItem(label: 'Losers', value: stats['losers']?.toString() ?? '--', color: AppTheme.loss),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatCurrency(dynamic val) {
    if (val == null) return '--';
    final n = (val as num).toDouble();
    if (n >= 1e9) return 'NPR ${(n / 1e9).toStringAsFixed(2)}B';
    if (n >= 1e6) return 'NPR ${(n / 1e6).toStringAsFixed(2)}M';
    return 'NPR ${NumberFormat('#,##0').format(n)}';
  }
}

class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  final Color? color;
  const _StatItem({required this.label, required this.value, this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: color ?? AppTheme.primaryText)),
        Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.secondaryText)),
      ],
    );
  }
}

class _NepseChart extends StatelessWidget {
  final List<dynamic> data;
  const _NepseChart({required this.data});

  @override
  Widget build(BuildContext context) {
    final spots = <FlSpot>[];
    for (int i = 0; i < data.length; i++) {
      final val = (data[i]['value'] ?? data[i]['close'] ?? 0) as num;
      spots.add(FlSpot(i.toDouble(), val.toDouble()));
    }
    if (spots.isEmpty) return const SizedBox.shrink();

    final minY = spots.map((s) => s.y).reduce((a, b) => a < b ? a : b) * 0.995;
    final maxY = spots.map((s) => s.y).reduce((a, b) => a > b ? a : b) * 1.005;
    final isUp = spots.last.y >= spots.first.y;

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 16, 12, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('NEPSE — 30 Days', style: TextStyle(color: AppTheme.secondaryText, fontSize: 12)),
            const SizedBox(height: 12),
            SizedBox(
              height: 140,
              child: LineChart(LineChartData(
                minY: minY,
                maxY: maxY,
                gridData: const FlGridData(show: false),
                borderData: FlBorderData(show: false),
                titlesData: const FlTitlesData(show: false),
                lineTouchData: const LineTouchData(enabled: false),
                lineBarsData: [
                  LineChartBarData(
                    spots: spots,
                    isCurved: true,
                    color: isUp ? AppTheme.gain : AppTheme.loss,
                    barWidth: 2,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      color: (isUp ? AppTheme.gain : AppTheme.loss).withValues(alpha: 0.1),
                    ),
                  ),
                ],
              )),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickActionsRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _ActionCard(icon: Icons.bar_chart, label: 'Browse Stocks', onTap: () => context.go('/stocks'))),
        const SizedBox(width: 12),
        Expanded(child: _ActionCard(icon: Icons.chat_bubble_outline, label: 'Ask AI', onTap: () => context.go('/chat'))),
      ],
    );
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _ActionCard({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20),
          child: Column(
            children: [
              Icon(icon, color: AppTheme.brand, size: 28),
              const SizedBox(height: 8),
              Text(label, style: const TextStyle(fontSize: 13, color: AppTheme.primaryText)),
            ],
          ),
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.wifi_off, size: 48, color: AppTheme.secondaryText),
        const SizedBox(height: 12),
        Text(message, style: const TextStyle(color: AppTheme.secondaryText)),
        const SizedBox(height: 16),
        ElevatedButton(onPressed: onRetry, child: const Text('Retry')),
      ]),
    );
  }
}
