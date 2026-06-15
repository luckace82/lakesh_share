import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:provider/provider.dart';

import 'services/auth_service.dart';
import 'utils/app_theme.dart';
import 'router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');
  runApp(const LakeshShareApp());
}

class LakeshShareApp extends StatefulWidget {
  const LakeshShareApp({super.key});

  @override
  State<LakeshShareApp> createState() => _LakeshShareAppState();
}

class _LakeshShareAppState extends State<LakeshShareApp> {
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
            title: 'Lakesh Share',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.dark,
            routerConfig: router,
          );
        },
      ),
    );
  }
}
