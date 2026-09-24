import React from 'react';
import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import TodoListScreen from './screens/TodoListScreen';

const httpLink = createHttpLink({
  // Automatically match the local machine IP where Metro is running
  uri: 'http://192.168.0.7:4000/', 
});

const authLink = setContext(async (_, { headers }) => {
  const email = await AsyncStorage.getItem('userEmail');
  return {
    headers: {
      ...headers,
      authorization: email ? email : "",
    }
  }
});

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache()
});

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <ApolloProvider client={client}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TodoList" component={TodoListScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </ApolloProvider>
  );
}
