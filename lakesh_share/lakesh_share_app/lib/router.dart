import 'package:go_router/go_router.dart';

import 'services/auth_service.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/register_screen.dart';
import 'screens/shell/app_shell.dart';
import 'screens/dashboard/dashboard_screen.dart';
import 'screens/stocks/stocks_screen.dart';
import 'screens/stocks/stock_detail_screen.dart';
import 'screens/watchlist/watchlist_screen.dart';
import 'screens/portfolio/portfolio_screen.dart';
import 'screens/chat/chat_screen.dart';

GoRouter buildRouter(AuthService auth) {
  return GoRouter(
    refreshListenable: auth,
    redirect: (_, state) {
      final loggedIn = auth.isAuthenticated;
      final onAuth = state.matchedLocation == '/login' ||
          state.matchedLocation == '/register';
      if (!loggedIn && !onAuth) return '/login';
      if (loggedIn && onAuth) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          GoRoute(
            path: '/',
            builder: (_, __) => const DashboardScreen(),
          ),
          GoRoute(
            path: '/stocks',
            builder: (_, __) => const StocksScreen(),
            routes: [
              GoRoute(
                path: ':symbol',
                builder: (_, state) =>
                    StockDetailScreen(symbol: state.pathParameters['symbol']!),
              ),
            ],
          ),
          GoRoute(
            path: '/watchlist',
            builder: (_, __) => const WatchlistScreen(),
          ),
          GoRoute(
            path: '/portfolio',
            builder: (_, __) => const PortfolioScreen(),
          ),
          GoRoute(
            path: '/chat',
            builder: (_, __) => const ChatScreen(),
          ),
        ],
      ),
    ],
  );
}
