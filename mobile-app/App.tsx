import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
  StatusBar,
  Animated,
  Easing
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import {
  MapPin,
  Award,
  Plus,
  Send,
  CloudOff,
  CloudLightning,
  RefreshCw,
  X,
  Shield,
  Image as ImageIcon,
  Camera,
  Info
} from 'lucide-react-native';

// --- Types ---
interface OfflineReport {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  description: string;
  imageUri: string | null;
}

// --- Configuration ---
// Note: In development, using localhost will fail on physical mobile devices.
// We dynamically resolve the development endpoint.
const SPATIAL_SERVICE_BASE_URL = __DEV__
  ? 'http://10.0.2.2:8001' // Default Android Emulator loopback
  : 'https://api.communityhero.org'; // Production secure endpoint

// --- Secure Storage Encryption Helpers ---
// Basic lightweight XOR-Base64 cipher to obfuscate locally cached reports.
// This prevents direct plain-text exposure on AsyncStorage (SQLite database on device).
const SECURE_SALT = 'CommunityHeroSecureSalt99!@';

const encryptData = (data: string): string => {
  try {
    let xorStr = '';
    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i) ^ SECURE_SALT.charCodeAt(i % SECURE_SALT.length);
      xorStr += String.fromCharCode(charCode);
    }
    return customToBase64(xorStr);
  } catch (e) {
    console.error('Encryption failed, falling back to plaintext', e);
    return data;
  }
};

const decryptData = (ciphertext: string): string => {
  try {
    const rawStr = customFromBase64(ciphertext);
    let result = '';
    for (let i = 0; i < rawStr.length; i++) {
      const charCode = rawStr.charCodeAt(i) ^ SECURE_SALT.charCodeAt(i % SECURE_SALT.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (e) {
    console.error('Decryption failed, returning input', e);
    return ciphertext;
  }
};

// Base64 helper for environments without btoa/atob
const customToBase64 = (str: string): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  for (let i = 0; i < str.length; i += 3) {
    const c1 = str.charCodeAt(i);
    const c2 = i + 1 < str.length ? str.charCodeAt(i + 1) : NaN;
    const c3 = i + 2 < str.length ? str.charCodeAt(i + 2) : NaN;
    
    const byte1 = c1 >> 2;
    const byte2 = ((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4);
    const byte3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6);
    const byte4 = isNaN(c3) ? 64 : c3 & 63;
    
    output += chars.charAt(byte1) + chars.charAt(byte2) + (byte3 === 64 ? '=' : chars.charAt(byte3)) + (byte4 === 64 ? '=' : chars.charAt(byte4));
  }
  return output;
};

const customFromBase64 = (str: string): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charAt(i);
    if (char === '=') break;
    const value = chars.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 255);
    }
  }
  return output;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'report' | 'profile'>('report');
  
  // Form State
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Offline Caching State
  const [offlineQueue, setOfflineQueue] = useState<OfflineReport[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  // Gamification State
  const [userPoints, setUserPoints] = useState(120);
  const [userLevel, setUserLevel] = useState(2);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [recentBadges] = useState<string[]>(['First Reporter', 'Pothole Patrol']);

  // Level Up Animations
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Load offline queue on startup
  useEffect(() => {
    loadOfflineQueue();
  }, []);

  useEffect(() => {
    if (showLevelUp) {
      scaleAnim.setValue(0);
      rotateAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [showLevelUp]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const loadOfflineQueue = async () => {
    try {
      const stored = await AsyncStorage.getItem('@offline_reports');
      if (stored) {
        const decrypted = decryptData(stored);
        setOfflineQueue(JSON.parse(decrypted));
      }
    } catch (e) {
      console.warn('Failed to load or decrypt offline reports', e);
    }
  };

  const saveOfflineQueue = async (queue: OfflineReport[]) => {
    try {
      const serialized = JSON.stringify(queue);
      const encrypted = encryptData(serialized);
      await AsyncStorage.setItem('@offline_reports', encrypted);
      setOfflineQueue(queue);
    } catch (e) {
      console.warn('Failed to encrypt or save offline reports', e);
    }
  };

  // Capture GPS Location
  const requestLocation = async () => {
    setIsLocating(true);
    
    // Safety check: is location service turned on?
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      Alert.alert('GPS Disabled 📍', 'Please enable location services (GPS) in your device settings.');
      setIsLocating(false);
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied 🚫', 'Location permission is required to geotag civic reports.');
      setIsLocating(false);
      return;
    }

    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      setLocation(loc);
    } catch (e) {
      Alert.alert('Error', 'Could not retrieve location. Check your GPS connection.');
    } finally {
      setIsLocating(false);
    }
  };

  // Launch Native Camera
  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied 🚫', 'Camera permission is required to take photo evidence.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  // Choose from Photo Gallery
  const launchImageLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied 🚫', 'Gallery access permission is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  // Input Sanitization
  const sanitizeText = (text: string): string => {
    return text.replace(/<[^>]*>/g, '').trim();
  };

  // Submit Report
  const handleSubmit = async () => {
    const cleanDesc = sanitizeText(description);
    if (!cleanDesc) {
      Alert.alert('Validation Error ⚠️', 'Please provide issue description details.');
      return;
    }

    if (cleanDesc.length > 500) {
      Alert.alert('Validation Error ⚠️', 'Description details must not exceed 500 characters.');
      return;
    }

    if (!location) {
      Alert.alert('Location Required 📍', 'Please capture your GPS coordinates first.');
      return;
    }

    setIsSubmitting(true);

    const reportPayload: OfflineReport = {
      id: `rep-${Date.now()}`,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: new Date().toISOString(),
      description: cleanDesc,
      imageUri
    };

    if (!isOnline) {
      // Offline queue insertion
      const updatedQueue = [...offlineQueue, reportPayload];
      await saveOfflineQueue(updatedQueue);
      Alert.alert(
        'Saved Offline 📁',
        'You are currently offline. The report has been securely cached and will sync automatically when you regain connection.'
      );
      resetForm();
    } else {
      try {
        const formData = new FormData();
        formData.append('latitude', reportPayload.latitude.toString());
        formData.append('longitude', reportPayload.longitude.toString());
        formData.append('reporter_id', 'user-jd-123'); // Autocomplete authenticated user ID placeholder
        
        if (reportPayload.imageUri) {
          const filename = reportPayload.imageUri.split('/').pop() || 'photo.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/jpeg`;
          
          formData.append('media', {
            uri: reportPayload.imageUri,
            name: filename,
            type: type,
          } as any);
        }

        const response = await fetch(`${SPATIAL_SERVICE_BASE_URL}/reports/create`, {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'multipart/form-data',
          },
        });

        if (!response.ok) {
          throw new Error(`Server returned code ${response.status}`);
        }

        const resData = await response.json();
        
        // Award points for submitting report
        const pointsEarned = 10;
        const newPoints = userPoints + pointsEarned;
        setUserPoints(newPoints);
        
        // Level up check (every 100 points is a new level)
        const newLevel = Math.floor(newPoints / 100) + 1;
        if (newLevel > userLevel) {
          setUserLevel(newLevel);
          setShowLevelUp(true);
        }

        if (resData.duplicate_warning) {
          Alert.alert(
            'Report Received ⚠️',
            `Report submitted! Note: A similar issue has already been reported nearby (${resData.duplicate_warning.status || 'Active'}).`
          );
        } else {
          Alert.alert(
            'Success! 🚀',
            `Report successfully saved to hyperlocal server. You earned +${pointsEarned} Hero Points!`
          );
        }
        resetForm();
      } catch (error) {
        console.warn('Network upload failed', error);
        Alert.alert(
          'Sync/Connection Offline ❌',
          'Could not establish a connection to the hyperlocal service. Would you like to encrypt and cache this report locally to upload later?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setIsSubmitting(false) },
            {
              text: 'Cache Offline',
              onPress: async () => {
                const updatedQueue = [...offlineQueue, reportPayload];
                await saveOfflineQueue(updatedQueue);
                resetForm();
              }
            }
          ]
        );
      }
    }
  };

  const syncOfflineQueue = async () => {
    if (offlineQueue.length === 0) return;
    setIsSubmitting(true);
    
    const remainingQueue: OfflineReport[] = [];
    let syncedCount = 0;
    
    for (const report of offlineQueue) {
      try {
        const formData = new FormData();
        formData.append('latitude', report.latitude.toString());
        formData.append('longitude', report.longitude.toString());
        formData.append('reporter_id', 'user-jd-123');
        
        if (report.imageUri) {
          const filename = report.imageUri.split('/').pop() || 'photo.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/jpeg`;
          
          formData.append('media', {
            uri: report.imageUri,
            name: filename,
            type: type,
          } as any);
        }
        
        const response = await fetch(`${SPATIAL_SERVICE_BASE_URL}/reports/create`, {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'multipart/form-data',
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to upload');
        }
        
        syncedCount++;
      } catch (err) {
        console.warn(`Failed to sync report ${report.id}`, err);
        remainingQueue.push(report);
      }
    }
    
    if (syncedCount > 0) {
      const pointsEarned = syncedCount * 10;
      const newPoints = userPoints + pointsEarned;
      setUserPoints(newPoints);
      
      const newLevel = Math.floor(newPoints / 100) + 1;
      if (newLevel > userLevel) {
        setUserLevel(newLevel);
        setShowLevelUp(true);
      }
      
      Alert.alert(
        'Sync Complete! ⚡',
        `Successfully uploaded ${syncedCount} cached reports. Earned +${pointsEarned} Hero Points!`
      );
    }
    
    if (remainingQueue.length > 0) {
      Alert.alert(
        'Sync Incomplete ⚠️',
        `${remainingQueue.length} report(s) could not be uploaded and remain securely cached.`
      );
    }
    
    await saveOfflineQueue(remainingQueue);
    setIsSubmitting(false);
  };

  const resetForm = () => {
    setDescription('');
    setLocation(null);
    setImageUri(null);
    setIsSubmitting(false);
  };

  const pointsToNextLevel = 100 - (userPoints % 100);
  const currentLevelProgress = (userPoints % 100) / 100;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header bar with glassmorphic styles */}
      <View style={styles.headerGlass}>
        <View style={styles.headerTitleContainer}>
          <Shield size={22} color="#06b6d4" />
          <Text style={styles.headerTitle}>Community Hero</Text>
        </View>

        {/* Network status toggler */}
        <TouchableOpacity
          onPress={() => setIsOnline(!isOnline)}
          style={[styles.networkStatus3d, { borderColor: isOnline ? '#10b981' : '#f59e0b', borderBottomColor: isOnline ? '#059669' : '#d97706' }]}
        >
          {isOnline ? (
            <CloudLightning size={13} color="#10b981" />
          ) : (
            <CloudOff size={13} color="#f59e0b" />
          )}
          <Text style={[styles.networkStatusText, { color: isOnline ? '#10b981' : '#f59e0b' }]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'report' ? (
          <View style={styles.cardGlass}>
            <Text style={styles.cardTitle}>Report Civic Issue</Text>

            {/* Description */}
            <Text style={styles.label}>Description / Details</Text>
            <TextInput
              style={styles.inputGlass}
              placeholder="What needs fixing? (e.g. pothole, broken streetlight...)"
              placeholderTextColor="#475569"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
            />

            {/* Camera / Photo Section */}
            <Text style={styles.label}>Photo Evidence</Text>
            {imageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <TouchableOpacity style={styles.removeImage3d} onPress={() => setImageUri(null)}>
                  <X size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoButtonRow}>
                <TouchableOpacity style={styles.photoButton3d} onPress={launchCamera}>
                  <Camera size={18} color="#06b6d4" />
                  <Text style={styles.photoButtonText}>Take Photo</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.photoButton3d} onPress={launchImageLibrary}>
                  <ImageIcon size={18} color="#06b6d4" />
                  <Text style={styles.photoButtonText}>From Gallery</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Geotag GPS */}
            <Text style={styles.label}>Geotag GPS Coordinates</Text>
            {location ? (
              <View style={styles.locationTag3d}>
                <MapPin size={16} color="#10b981" />
                <Text style={styles.locationTagText}>
                  {location.coords.latitude.toFixed(5)}, {location.coords.longitude.toFixed(5)}
                </Text>
                <TouchableOpacity style={styles.refreshLocButton} onPress={requestLocation}>
                  <RefreshCw size={14} color="#10b981" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.locationButton3d}
                onPress={requestLocation}
                disabled={isLocating}
              >
                {isLocating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MapPin size={18} color="#fff" />
                    <Text style={styles.locationButtonText}>Get Current Location</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={styles.submitButton3d}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Send size={16} color="#fff" />
                  <Text style={styles.submitButtonText}>
                    {isOnline ? 'SUBMIT REPORT' : 'CACHE OFFLINE'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          /* Profile / Gamification view */
          <View style={styles.cardGlass}>
            <View style={styles.profileHeader}>
              <View style={styles.avatarNeonBorder}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>JD</Text>
                </View>
              </View>
              <View>
                <Text style={styles.profileName}>Jane Doe</Text>
                <Text style={styles.profileLevel}>Level {userLevel} Advocate</Text>
              </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox3d}>
                <Text style={styles.statNumber}>{userPoints}</Text>
                <Text style={styles.statLabel}>Total Points</Text>
              </View>
              <View style={styles.statBox3d}>
                <Text style={styles.statNumber}>{recentBadges.length + (userLevel > 2 ? 1 : 0)}</Text>
                <Text style={styles.statLabel}>Badges</Text>
              </View>
            </View>

            {/* Level progress bar */}
            <Text style={styles.sectionTitle}>Level Progress</Text>
            <View style={styles.progressContainer}>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${currentLevelProgress * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {pointsToNextLevel} Points to Level {userLevel + 1}
              </Text>
            </View>

            {/* Badges list */}
            <Text style={styles.sectionTitle}>Unlocked Badges</Text>
            <View style={styles.badgeContainer}>
              {recentBadges.map((badge: string, idx: number) => (
                <View key={idx} style={styles.badge3d}>
                  <Award size={14} color="#fbbf24" />
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ))}
              {userLevel > 2 && (
                <View style={[styles.badge3d, { borderColor: '#a855f7', backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                  <Award size={14} color="#c084fc" />
                  <Text style={[styles.badgeText, { color: '#c084fc' }]}>Super Hero</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Offline cache notice card */}
        {offlineQueue.length > 0 && (
          <View style={styles.offlineAlert3d}>
            <CloudOff size={20} color="#fbbf24" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.offlineAlertTitle}>
                {offlineQueue.length} Secure Report(s) Queued
              </Text>
              <Text style={styles.offlineAlertDesc}>
                Cached locally and encrypted.
              </Text>
            </View>
            <TouchableOpacity
              onPress={syncOfflineQueue}
              disabled={isSubmitting}
              style={styles.syncButton3d}
            >
              <RefreshCw size={12} color="#fff" />
              <Text style={styles.syncButtonText}>Sync</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Level up modal with smooth scale & rotate animations */}
      <Modal visible={showLevelUp} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View style={[
            styles.modalContent3d,
            { transform: [{ scale: scaleAnim }, { rotate: spin }] }
          ]}>
            <View style={styles.avatarNeonBorder}>
              <Award size={48} color="#fbbf24" style={{ margin: 10 }} />
            </View>
            <Text style={styles.modalTitle}>LEVEL UP! 🎉</Text>
            <Text style={styles.modalDesc}>
              You reached Level {userLevel}! Thank you for keeping your community clean and safe.
            </Text>
            <TouchableOpacity style={styles.modalClose3d} onPress={() => setShowLevelUp(false)}>
              <Text style={styles.modalCloseText}>AWESOME</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Tab bar */}
      <View style={styles.tabBarGlass}>
        <TouchableOpacity
          onPress={() => setActiveTab('report')}
          style={[styles.tab, activeTab === 'report' && styles.activeTab3d]}
        >
          <Plus size={20} color={activeTab === 'report' ? '#06b6d4' : '#475569'} />
          <Text style={[styles.tabLabel, { color: activeTab === 'report' ? '#06b6d4' : '#475569' }]}>
            Report
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('profile')}
          style={[styles.tab, activeTab === 'profile' && styles.activeTab3d]}
        >
          <Award size={20} color={activeTab === 'profile' ? '#06b6d4' : '#475569'} />
          <Text style={[styles.tabLabel, { color: activeTab === 'profile' ? '#06b6d4' : '#475569' }]}>
            Gamification
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b14'
  },
  headerGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(56, 189, 248, 0.15)',
    backgroundColor: 'rgba(10, 15, 29, 0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#f8fafc',
    textShadowColor: 'rgba(6, 182, 212, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6
  },
  networkStatus3d: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderBottomWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.6)'
  },
  networkStatusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40
  },
  cardGlass: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.12)',
    borderBottomColor: 'rgba(56, 189, 248, 0.28)',
    borderBottomWidth: 3.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 20
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 16,
    letterSpacing: 0.3
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16
  },
  inputGlass: {
    backgroundColor: '#070b14',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.08)',
    borderBottomColor: 'rgba(56, 189, 248, 0.2)',
    borderBottomWidth: 2,
    borderRadius: 14,
    padding: 14,
    color: '#f1f5f9',
    fontSize: 14,
    textAlignVertical: 'top'
  },
  photoButtonRow: {
    flexDirection: 'row',
    gap: 12
  },
  photoButton3d: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#070b14',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.15)',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(6, 182, 212, 0.4)',
    borderRadius: 14,
    padding: 16,
    gap: 6
  },
  photoButtonText: {
    color: '#06b6d4',
    fontSize: 13,
    fontWeight: '700'
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.2)'
  },
  imagePreview: {
    width: '100%',
    height: 180,
    resizeMode: 'cover'
  },
  removeImage3d: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444'
  },
  locationButton3d: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
    borderBottomWidth: 4.5,
    borderBottomColor: '#0f172a',
    borderRadius: 14,
    padding: 14,
    gap: 8
  },
  locationButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700'
  },
  locationTag3d: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(16, 185, 129, 0.35)',
    padding: 14,
    borderRadius: 14,
    gap: 8
  },
  locationTagText: {
    flex: 1,
    color: '#34d399',
    fontSize: 13,
    fontWeight: '700'
  },
  refreshLocButton: {
    padding: 4
  },
  submitButton3d: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5e9',
    borderRadius: 15,
    padding: 16,
    marginTop: 25,
    gap: 8,
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderBottomWidth: 5,
    borderBottomColor: '#0284c7',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  tabBarGlass: {
    flexDirection: 'row',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(56, 189, 248, 0.15)',
    backgroundColor: 'rgba(10, 15, 29, 0.88)',
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 12
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4
  },
  activeTab3d: {
    transform: [{ scale: 1.04 }]
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '700'
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24
  },
  avatarNeonBorder: {
    borderRadius: 30,
    padding: 2,
    borderWidth: 2,
    borderColor: '#06b6d4',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#06b6d4',
    fontWeight: '900',
    fontSize: 18
  },
  profileName: {
    fontSize: 19,
    fontWeight: '900',
    color: '#fff'
  },
  profileLevel: {
    fontSize: 12,
    color: '#06b6d4',
    fontWeight: '700',
    marginTop: 2
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 25
  },
  statBox3d: {
    flex: 1,
    backgroundColor: '#070b14',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.1)',
    borderBottomWidth: 3.5,
    borderBottomColor: 'rgba(6, 182, 212, 0.25)',
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#06b6d4',
    textShadowColor: 'rgba(6, 182, 212, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#cbd5e1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 10
  },
  progressContainer: {
    backgroundColor: '#070b14',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#06b6d4',
    borderRadius: 4,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5
  },
  progressText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center'
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  badge3d: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(251, 191, 36, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 5
  },
  badgeText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700'
  },
  offlineAlert3d: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(202, 138, 4, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(202, 138, 4, 0.2)',
    borderBottomWidth: 3.5,
    borderBottomColor: 'rgba(202, 138, 4, 0.4)',
    borderRadius: 20,
    padding: 16,
    marginTop: 10
  },
  offlineAlertTitle: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '800'
  },
  offlineAlertDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600'
  },
  syncButton3d: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0ea5e9',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderBottomWidth: 3,
    borderBottomColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 12, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent3d: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 28,
    padding: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    borderBottomWidth: 6,
    borderBottomColor: 'rgba(6, 182, 212, 0.5)',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    marginTop: 15,
    marginBottom: 8,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(6, 182, 212, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6
  },
  modalDesc: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 24
  },
  modalClose3d: {
    backgroundColor: '#0ea5e9',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderBottomWidth: 4,
    borderBottomColor: '#0284c7',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5
  }
});
