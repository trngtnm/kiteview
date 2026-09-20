import React, {useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useTheme} from './ThemeProvider';
import type {Theme} from './theme';

type AuthPanelProps = {
  busy?: boolean;
  error?: string | null;
  info?: string | null;
  onSignIn: (email: string, password: string) => void;
  onSignUp: (email: string, password: string) => void;
  onClose: () => void;
};

/**
 * Uncontrolled TextInputs — react-native-macos often fails to sync controlled
 * `value` / onChangeText for password fields, which made validation see "".
 */
export function AuthPanel({
  busy = false,
  error,
  info,
  onSignIn,
  onSignUp,
  onClose,
}: AuthPanelProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [localError, setLocalError] = useState<string | null>(null);
  const [inputEpoch, setInputEpoch] = useState(0);
  const [showPassword, setShowPassword] = useState(true);
  const emailRef = useRef('');
  const passwordRef = useRef('');
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const captureText = (
    which: 'email' | 'password',
    text: string | undefined | null,
  ) => {
    const next = typeof text === 'string' ? text : '';
    if (which === 'email') {
      emailRef.current = next;
    } else {
      passwordRef.current = next;
    }
    if (localError) {
      setLocalError(null);
    }
  };

  const runSubmit = () => {
    if (busy) return;
    const nextEmail = emailRef.current.trim();
    const nextPassword = passwordRef.current;
    if (!nextEmail || !nextEmail.includes('@')) {
      setLocalError('Enter a valid email address.');
      return;
    }
    if (nextPassword.length < 6) {
      setLocalError(
        'Password must be at least 6 characters. If it looks filled in, click the field once more then try again.',
      );
      return;
    }
    setLocalError(null);
    if (mode === 'signin') {
      onSignIn(nextEmail, nextPassword);
    } else {
      onSignUp(nextEmail, nextPassword);
    }
  };

  const submit = () => {
    // Blur so onEndEditing can flush the latest native text into refs (macOS).
    emailInputRef.current?.blur();
    passwordInputRef.current?.blur();
    setTimeout(runSubmit, 40);
  };

  const displayError = localError || error;

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.card} accessibilityLabel="Account">
        <View style={styles.header}>
          <Text style={styles.title}>
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close account"
            onPress={onClose}
            style={styles.close}>
            <Text style={styles.closeLabel}>✕</Text>
          </Pressable>
        </View>

        <Text style={styles.meta}>
          Optional — guests can still annotate with default preferences.
        </Text>

        <TextInput
          key={`email-${inputEpoch}`}
          ref={emailInputRef}
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onChange={event =>
            captureText('email', event.nativeEvent?.text)
          }
          onChangeText={text => captureText('email', text)}
          onEndEditing={event =>
            captureText('email', event.nativeEvent?.text)
          }
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          style={styles.input}
          defaultValue=""
        />
        <TextInput
          key={`password-${inputEpoch}-${showPassword ? 'plain' : 'secure'}`}
          ref={passwordInputRef}
          accessibilityLabel="Password"
          autoCapitalize="none"
          autoCorrect={false}
          onChange={event =>
            captureText('password', event.nativeEvent?.text)
          }
          onChangeText={text => captureText('password', text)}
          onEndEditing={event =>
            captureText('password', event.nativeEvent?.text)
          }
          onSubmitEditing={submit}
          placeholder="Password (6+ characters)"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={!showPassword}
          style={styles.input}
          defaultValue={passwordRef.current}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowPassword(v => !v)}
          style={styles.showPassword}>
          <Text style={styles.showPasswordLabel}>
            {showPassword ? 'Hide password' : 'Show password'}
          </Text>
        </Pressable>

        {displayError ? <Text style={styles.error}>{displayError}</Text> : null}
        {info && !displayError ? <Text style={styles.info}>{info}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={submit}
          style={[styles.primary, busy && styles.disabled]}>
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryLabel}>
              {mode === 'signin' ? 'Sign in' : 'Sign up'}
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setLocalError(null);
            emailRef.current = '';
            passwordRef.current = '';
            setInputEpoch(n => n + 1);
            setMode(current => (current === 'signin' ? 'signup' : 'signin'));
          }}
          style={styles.switch}>
          <Text style={styles.switchLabel}>
            {mode === 'signin'
              ? 'Need an account? Sign up'
              : 'Have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
    width: '100%',
    maxWidth: 340,
    paddingTop: 12,
    paddingHorizontal: 10,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    padding: 14,
    borderRadius: 12,
    backgroundColor: theme.pageSurface,
    shadowColor: theme.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 2},
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    color: theme.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  close: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.chipBg,
  },
  closeLabel: {color: theme.textSecondary, fontSize: 13, fontWeight: '600'},
  meta: {
    marginTop: 8,
    marginBottom: 12,
    color: theme.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.textPrimary,
    backgroundColor: theme.inputBg,
  },
  showPassword: {
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  showPasswordLabel: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  primary: {
    marginTop: 14,
    backgroundColor: theme.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  disabled: {opacity: 0.45},
  primaryLabel: {color: theme.accentText, fontSize: 14, fontWeight: '700'},
  switch: {marginTop: 12, alignItems: 'center'},
  switchLabel: {color: theme.accent, fontSize: 13, fontWeight: '600'},
  error: {marginTop: 10, color: theme.danger, fontSize: 13, lineHeight: 18},
  info: {marginTop: 10, color: theme.textSecondary, fontSize: 13, lineHeight: 18},
});
}
