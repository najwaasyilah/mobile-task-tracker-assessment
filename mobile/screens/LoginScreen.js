import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { gql, useMutation } from '@apollo/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const LOGIN_MUTATION = gql`
  mutation Login($email: String!) {
    login(email: $email) {
      id
      email
    }
  }
`;

const SIGNUP_MUTATION = gql`
  mutation Signup($email: String!) {
    signup(email: $email) {
      id
      email
    }
  }
`;

export default function LoginScreen({ navigation }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [login, { loading: loginLoading, error: loginError }] = useMutation(LOGIN_MUTATION);
  const [signup, { loading: signupLoading, error: signupError }] = useMutation(SIGNUP_MUTATION);

  const handleAuth = async () => {
    if (!email) return;
    try {
      if (isLogin) {
        const { data } = await login({ variables: { email } });
        if (data?.login) {
          await AsyncStorage.setItem('userEmail', data.login.email);
          await AsyncStorage.setItem('userId', data.login.id);
          navigation.replace('TodoList');
        }
      } else {
        const { data } = await signup({ variables: { email } });
        if (data?.signup) {
          await AsyncStorage.setItem('userEmail', data.signup.email);
          await AsyncStorage.setItem('userId', data.signup.id);
          navigation.replace('TodoList');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <View style={styles.screenWrapper}>
      <LinearGradient 
        colors={['#f8fafc', '#f1f5f9', '#e2e8f0']} 
        start={{x: 0, y: 0}} end={{x: 1, y: 1}} 
        style={StyleSheet.absoluteFillObject} 
      />
      
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFillObject} />
      
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.header}>
            {/* Header spacer to maintain layout */}
            <View style={{ height: 44 }} />
          </View>

            <View style={styles.content}>
              <Text style={styles.title}>{isLogin ? 'Welcome Back!' : 'Create Account'}</Text>
              <Text style={styles.subtitle}>
                {isLogin 
                  ? "Your tasks are waiting. Let's log in to keep up with your productive day."
                  : "Join us and start organizing your tasks efficiently today."}
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email address"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.inputPassword}
                    placeholder="Enter your password"
                    placeholderTextColor="#9ca3af"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity 
                    style={styles.eyeIcon} 
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={{color: '#9ca3af'}}>{showPassword ? '👁' : ''}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {loginError && isLogin && <Text style={styles.errorText}>{loginError.message.replace('ApolloError: ', '')}</Text>}
              {signupError && !isLogin && <Text style={styles.errorText}>{signupError.message.replace('ApolloError: ', '')}</Text>}
              
              <TouchableOpacity 
                style={[styles.button, (loginLoading || signupLoading) && styles.buttonDisabled]} 
                onPress={handleAuth}
                disabled={loginLoading || signupLoading}
              >
                {(loginLoading || signupLoading) ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{isLogin ? 'Sign In' : 'Sign Up'}</Text>
                )}
              </TouchableOpacity>

              <View style={styles.signupWrapper}>
                <Text style={styles.signupText}>
                  {isLogin ? "Don't have an account? " : "Already have an account? "}
                </Text>
                <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                  <Text style={styles.signupLink}>{isLogin ? 'Sign Up' : 'Sign In'}</Text>
                </TouchableOpacity>
              </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: { flex: 1, backgroundColor: '#f8fafc' },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  blob: { position: 'absolute', width: 280, height: 280, borderRadius: 140, opacity: 0.2 },
  glassContainer: { flex: 1, margin: 20, marginTop: 40, marginBottom: 40, borderRadius: 40, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.3)' },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
    marginTop: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  backArrow: {
    fontSize: 20,
    color: '#374151',
  },
  helpText: {
    color: '#6236FF',
    fontWeight: '600',
    fontSize: 16,
  },

  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 36,
    lineHeight: 22,
    paddingRight: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: '#111827',
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputPassword: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    paddingRight: 50,
    fontSize: 15,
    color: '#111827',
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  forgotWrapper: {
    alignItems: 'flex-end',
    marginTop: 12,
  },
  forgotText: {
    color: '#6236FF',
    fontWeight: '700',
    fontSize: 13,
  },
  button: {
    backgroundColor: '#6236FF',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#6236FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signupWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  signupText: {
    color: '#6b7280',
    fontSize: 14,
  },
  signupLink: {
    color: '#6236FF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ef4444',
    marginBottom: 16,
    textAlign: 'center',
  }
});
