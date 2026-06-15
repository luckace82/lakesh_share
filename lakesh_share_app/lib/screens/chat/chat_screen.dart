import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../services/api_client.dart';
import '../../utils/app_theme.dart';

class _Message {
  final String role;
  final String content;
  final DateTime timestamp;
  final bool isError;
  const _Message({required this.role, required this.content, required this.timestamp, this.isError = false});
}

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _api = ApiClient();
  final _inputCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final List<_Message> _messages = [];
  bool _loading = false;

  static const _suggestions = [
    'How are banking stocks performing?',
    'What about NABIL?',
    'Analyze my portfolio',
  ];

  @override
  void dispose() {
    _inputCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _send([String? text]) async {
    final query = (text ?? _inputCtrl.text).trim();
    if (query.isEmpty || _loading) return;

    setState(() {
      _messages.add(_Message(role: 'user', content: query, timestamp: DateTime.now()));
      _loading = true;
    });
    _inputCtrl.clear();
    _scrollToBottom();

    try {
      final res = await _api.chatQuery(query);
      final aiText = res.data['ai_response'] ?? res.data['response'] ?? 'No response';
      setState(() {
        _messages.add(_Message(role: 'assistant', content: aiText, timestamp: DateTime.now()));
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _messages.add(_Message(
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: DateTime.now(),
          isError: true,
        ));
        _loading = false;
      });
    }
    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(_scrollCtrl.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(children: [
          Icon(Icons.smart_toy_outlined, color: AppTheme.brand),
          SizedBox(width: 8),
          Text('AI Stock Assistant'),
        ]),
      ),
      body: Column(children: [
        Expanded(
          child: _messages.isEmpty
              ? _EmptyState(suggestions: _suggestions, onTap: _send)
              : ListView.builder(
                  controller: _scrollCtrl,
                  padding: const EdgeInsets.all(16),
                  itemCount: _messages.length + (_loading ? 1 : 0),
                  itemBuilder: (context, i) {
                    if (i == _messages.length) return const _TypingIndicator();
                    return _MessageBubble(message: _messages[i]);
                  },
                ),
        ),
        _InputBar(
          controller: _inputCtrl,
          loading: _loading,
          onSend: () => _send(),
        ),
      ]),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final List<String> suggestions;
  final ValueChanged<String> onTap;
  const _EmptyState({required this.suggestions, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.smart_toy_outlined, size: 56, color: AppTheme.brand),
          const SizedBox(height: 12),
          const Text('AI Stock Assistant', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.primaryText)),
          const SizedBox(height: 6),
          const Text('Ask me anything about NEPSE stocks', style: TextStyle(color: AppTheme.secondaryText)),
          const SizedBox(height: 24),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: suggestions.map((s) => ActionChip(
              label: Text(s, style: const TextStyle(fontSize: 12, color: AppTheme.secondaryText)),
              backgroundColor: AppTheme.cardBg,
              side: const BorderSide(color: AppTheme.border),
              onPressed: () => onTap(s),
            )).toList(),
          ),
        ]),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final _Message message;
  const _MessageBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == 'user';
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isUser) ...[
            Container(
              width: 32, height: 32,
              decoration: BoxDecoration(color: AppTheme.brand, borderRadius: BorderRadius.circular(8)),
              child: const Icon(Icons.smart_toy_outlined, size: 18, color: Colors.white),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: isUser
                        ? AppTheme.brand
                        : message.isError
                            ? AppTheme.loss.withValues(alpha: 0.15)
                            : AppTheme.cardBg,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: Radius.circular(isUser ? 16 : 4),
                      bottomRight: Radius.circular(isUser ? 4 : 16),
                    ),
                    border: isUser ? null : Border.all(color: AppTheme.border),
                  ),
                  child: Text(message.content, style: TextStyle(
                    color: isUser ? Colors.white : AppTheme.primaryText,
                    fontSize: 14,
                  )),
                ),
                const SizedBox(height: 2),
                Text(
                  DateFormat('h:mm a').format(message.timestamp),
                  style: const TextStyle(fontSize: 10, color: AppTheme.secondaryText),
                ),
              ],
            ),
          ),
          if (isUser) ...[
            const SizedBox(width: 8),
            Container(
              width: 32, height: 32,
              decoration: BoxDecoration(color: AppTheme.brand, borderRadius: BorderRadius.circular(8)),
              child: const Icon(Icons.person, size: 18, color: Colors.white),
            ),
          ],
        ],
      ),
    );
  }
}

class _TypingIndicator extends StatelessWidget {
  const _TypingIndicator();

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Container(
        width: 32, height: 32,
        decoration: BoxDecoration(color: AppTheme.brand, borderRadius: BorderRadius.circular(8)),
        child: const Icon(Icons.smart_toy_outlined, size: 18, color: Colors.white),
      ),
      const SizedBox(width: 8),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppTheme.cardBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.border),
        ),
        child: const Row(mainAxisSize: MainAxisSize.min, children: [
          SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.brand)),
          SizedBox(width: 8),
          Text('Thinking...', style: TextStyle(color: AppTheme.secondaryText, fontSize: 13)),
        ]),
      ),
    ]);
  }
}

class _InputBar extends StatelessWidget {
  final TextEditingController controller;
  final bool loading;
  final VoidCallback onSend;
  const _InputBar({required this.controller, required this.loading, required this.onSend});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      decoration: const BoxDecoration(
        color: AppTheme.cardBg,
        border: Border(top: BorderSide(color: AppTheme.border)),
      ),
      child: Row(children: [
        Expanded(
          child: TextField(
            controller: controller,
            onSubmitted: (_) => onSend(),
            enabled: !loading,
            decoration: const InputDecoration(
              hintText: 'Ask about stocks, market trends...',
              isDense: true,
              contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            ),
          ),
        ),
        const SizedBox(width: 8),
        IconButton.filled(
          onPressed: loading ? null : onSend,
          icon: loading
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.send_rounded),
          style: IconButton.styleFrom(backgroundColor: AppTheme.brand, foregroundColor: Colors.white),
        ),
      ]),
    );
  }
}
