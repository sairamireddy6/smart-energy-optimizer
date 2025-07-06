import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, StyleSheet, Button, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import * as Location from 'expo-location';

const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';
const HOME_COORDS = { latitude: 17.385044, longitude: 78.486671 }; // Replace with your actual home coordinates

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // in meters
}

export default function SmartEnergyDashboard() {
  const dummyEnergyData = [50, 40, 60, 30, 55];

  const [accessToken, setAccessToken] = useState(null);
  const [devices, setDevices] = useState([
    { id: 1, name: 'Living Room Light', icon: 'bulb-outline', status: true, usage: '10W' },
    { id: 2, name: 'Bedroom AC', icon: 'thermometer-outline', status: false, usage: '1200W' },
    { id: 3, name: 'Smart Plug - TV', icon: 'tv-outline', status: true, usage: '80W' },
  ]);
  const [distanceFromHome, setDistanceFromHome] = useState(null);

  const maxUsage = Math.max(...dummyEnergyData);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: ['openid', 'profile', 'email', 'https://www.googleapis.com/auth/homegraph'],
      redirectUri: AuthSession.makeRedirectUri({ useProxy: true }),
    },
    discovery
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const { access_token } = response.authentication;
      setAccessToken(access_token);
    }
  }, [response]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied for location');
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      const distance = calculateDistance(
        HOME_COORDS.latitude,
        HOME_COORDS.longitude,
        location.coords.latitude,
        location.coords.longitude
      );
      setDistanceFromHome(Math.round(distance));

      if (distance > 500) {
        executeDeviceOnOff('demo-device-2', false); // Demo turn off Bedroom AC if far
      }
    })();
  }, [accessToken]);

  const reportDemoDeviceState = async () => {
    if (!accessToken) return Alert.alert('Not authenticated');

    const body = {
      requestId: 'demo-1234',
      agentUserId: 'user-abc',
      payload: {
        devices: {
          states: {
            'demo-device-id': {
              on: true,
              online: true,
              currentEnergyUse: 22.5,
            },
          },
        },
      },
    };

    try {
      const res = await fetch('https://homegraph.googleapis.com/v1/devices:reportStateAndNotification', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      Alert.alert('Reported device state', JSON.stringify(json));
    } catch (err) {
      console.error(err);
      Alert.alert('Error reporting device state');
    }
  };

  const executeDeviceOnOff = async (deviceId, turnOn) => {
    if (!accessToken) return Alert.alert('Not authenticated');

    const body = {
      agentUserId: 'user-abc',
      commands: [
        {
          deviceIds: [deviceId],
          execution: [
            {
              command: 'action.devices.commands.OnOff',
              params: {
                on: turnOn,
              },
            },
          ],
        },
      ],
    };

    try {
      const res = await fetch('https://homegraph.googleapis.com/v1/devices:execute', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      Alert.alert('Executed device command', JSON.stringify(json));
    } catch (err) {
      console.error(err);
      Alert.alert('Error executing device command');
    }
  };

  const toggleDevice = (id) => {
    const updated = devices.map((dev) => {
      if (dev.id === id) {
        const newStatus = !dev.status;
        executeDeviceOnOff(`demo-device-${id}`, newStatus);
        return { ...dev, status: newStatus };
      }
      return dev;
    });
    setDevices(updated);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Smart Energy Optimizer</Text>
      <Text style={styles.subtitle}>Monitor and optimize your home energy usage</Text>

      <Button title="Login with Google" onPress={() => promptAsync()} disabled={!request} />
      <Button title="Report Demo Device State" onPress={reportDemoDeviceState} disabled={!accessToken} />

      {distanceFromHome !== null && (
        <View style={styles.distanceBox}>
          <Text style={styles.tipTitle}>Distance from Home</Text>
          <Text style={styles.tipText}>{distanceFromHome} meters</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Energy Usage</Text>
        <View style={styles.barChart}>
          {dummyEnergyData.map((value, index) => {
            const barHeight = (value / maxUsage) * 120;
            return (
              <View key={index} style={styles.barWrapper}>
                <View style={[styles.bar, { height: barHeight }]} />
                <Text style={styles.barLabel}>Day {index + 1}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Connected Devices</Text>
      {devices.map((device) => (
        <View key={device.id} style={styles.deviceCard}>
          <View style={styles.deviceInfo}>
            <Ionicons name={device.icon} size={28} color="#4F46E5" style={styles.deviceIcon} />
            <View>
              <Text style={styles.deviceName}>{device.name}</Text>
              <Text style={styles.deviceUsage}>Usage: {device.usage}</Text>
            </View>
          </View>
          <Switch value={device.status} onValueChange={() => toggleDevice(device.id)} />
        </View>
      ))}

      <View style={styles.tipBox}>
        <Text style={styles.tipTitle}>Smart Tips</Text>
        <Text style={styles.tipText}>
          You're using 8% more power than yesterday. Consider turning off idle devices.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', padding: 16, flex: 1 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 16 },

  section: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },

  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 140,
    marginTop: 12,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 16,
    backgroundColor: '#4F46E5',
    borderRadius: 4,
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 10,
    color: '#6B7280',
  },

  deviceCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  deviceInfo: { flexDirection: 'row', alignItems: 'center' },
  deviceIcon: { marginRight: 12 },
  deviceName: { fontSize: 16, fontWeight: '500' },
  deviceUsage: { fontSize: 12, color: '#6B7280' },

  tipBox: {
    marginTop: 24,
    backgroundColor: '#EEF2FF',
    padding: 16,
    borderRadius: 16,
  },
  tipTitle: { fontSize: 18, fontWeight: '600' },
  tipText: { marginTop: 8, fontSize: 14, color: '#3730A3' },

  distanceBox: {
    marginTop: 16,
    backgroundColor: '#E0F2FE',
    padding: 16,
    borderRadius: 16,
  },
});