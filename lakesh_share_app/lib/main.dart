import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:provider/provider.dart';

import 'services/auth_service.dart';
import 'utils/app_theme.dart';
import 'router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');
  runApp(const DhanLabhApp());
}

class DhanLabhApp extends StatefulWidget {
  const DhanLabhApp({super.key});

  @override
  State<DhanLabhApp> createState() => _DhanLabhAppState();
}

class _DhanLabhAppState extends State<DhanLabhApp> {
  final _auth = AuthService();
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _auth.init().then((_) => setState(() => _ready = true));
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) {
      return const MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          backgroundColor: AppTheme.pageBg,
          body: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    return ChangeNotifierProvider.value(
      value: _auth,
      child: Builder(
        builder: (context) {
          final router = buildRouter(_auth);
          return MaterialApp.router(
            title: 'DhanLabh',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.dark,
            routerConfig: router,
          );
        },
      ),
    );
  }
}
