import 'package:flutter/material.dart';

class AppTheme {
  static const Color brand = Color(0xFF6366F1);
  static const Color gain = Color(0xFF22C55E);
  static const Color loss = Color(0xFFEF4444);
  static const Color pageBg = Color(0xFF0F172A);
  static const Color cardBg = Color(0xFF1E293B);
  static const Color border = Color(0xFF334155);
  static const Color primaryText = Color(0xFFF1F5F9);
  static const Color secondaryText = Color(0xFF94A3B8);

  static ThemeData get dark => ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: pageBg,
        colorScheme: const ColorScheme.dark(
          primary: brand,
          surface: cardBg,
          onSurface: primaryText,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: pageBg,
          foregroundColor: primaryText,
          elevation: 0,
          surfaceTintColor: Colors.transparent,
        ),
        cardTheme: const CardThemeData(
          color: cardBg,
          surfaceTintColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(12)),
            side: BorderSide(color: border),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: cardBg,
          hintStyle: const TextStyle(color: secondaryText),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: brand, width: 2),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: brand,
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(foregroundColor: brand),
        ),
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: cardBg,
          selectedItemColor: brand,
          unselectedItemColor: secondaryText,
          type: BottomNavigationBarType.fixed,
          elevation: 0,
        ),
        dividerColor: border,
        textTheme: const TextTheme(
          bodyMedium: TextStyle(color: primaryText),
          bodySmall: TextStyle(color: secondaryText),
        ),
      );
}
