'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Server, Database, Cpu, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface SystemStats {
  timestamp: string;
  active_users: number;
  system_load: number;
  memory_usage: number;
  database_connections: number;
  api_requests_per_minute: number;
}

interface SystemAlert {
  type: string;
  message: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface SystemMonitoringProps {
  refreshInterval?: number; // in seconds
}

function SystemMonitoring({ refreshInterval = 30 }: SystemMonitoringProps) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSystemData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsData, alertsData, healthData] = await Promise.allSettled([
        apiClient.getSystemMetrics(),
        apiClient.getSystemAlerts(),
        apiClient.getSystemHealth()
      ]);

      if (statsData.status === 'fulfilled') {
        setStats(statsData.value);
      }

      if (alertsData.status === 'fulfilled') {
        setAlerts(alertsData.value.alerts || []);
      }

      if (healthData.status === 'fulfilled') {
        setHealth(healthData.value);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch system data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSystemData();
    const interval = setInterval(fetchSystemData, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [fetchSystemData, refreshInterval]);

  const getStatusColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'text-red-600';
    if (value >= thresholds.warning) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusIcon = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return <AlertTriangle className="w-5 h-5 text-red-500" />;
    if (value >= thresholds.warning) return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!stats && !health) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Loading system data...</p>
        </div>
      </div>
    );
  }

  // Provide default values to prevent undefined errors
  const safeStats = {
    system_load: stats?.system_load ?? 0,
    memory_usage: stats?.memory_usage ?? 0,
    active_users: stats?.active_users ?? 0,
    database_connections: stats?.database_connections ?? 0,
    api_requests_per_minute: stats?.api_requests_per_minute ?? 0,
    timestamp: stats?.timestamp ?? new Date().toISOString()
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">System Monitoring</h2>
        <div className="flex items-center space-x-4">
          {lastUpdated && (
            <p className="text-sm text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
          <button
            onClick={fetchSystemData}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Health Status */}
      {health && (
        <div className={`p-4 rounded-lg border ${
          health.status === 'healthy' ? 'bg-green-50 border-green-200' :
          health.status === 'warning' ? 'bg-yellow-50 border-yellow-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center space-x-2">
            {health.status === 'healthy' ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
            )}
            <span className="font-medium">
              System Status: {health.status.toUpperCase()}
            </span>
          </div>
          {health.issues && health.issues.length > 0 && (
            <ul className="mt-2 text-sm text-gray-600">
              {health.issues.map((issue: string, index: number) => (
                <li key={index}>• {issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* System Metrics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* CPU Usage */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium text-gray-700">CPU Usage</span>
              </div>
              {getStatusIcon(safeStats.system_load, { warning: 70, critical: 90 })}
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline space-x-2">
                <span className={`text-2xl font-bold ${getStatusColor(safeStats.system_load, { warning: 70, critical: 90 })}`}>
                  {safeStats.system_load.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    safeStats.system_load >= 90 ? 'bg-red-500' :
                    safeStats.system_load >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(safeStats.system_load, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Memory Usage */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Server className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium text-gray-700">Memory Usage</span>
              </div>
              {getStatusIcon(safeStats.memory_usage, { warning: 80, critical: 90 })}
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline space-x-2">
                <span className={`text-2xl font-bold ${getStatusColor(safeStats.memory_usage, { warning: 80, critical: 90 })}`}>
                  {safeStats.memory_usage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    safeStats.memory_usage >= 90 ? 'bg-red-500' :
                    safeStats.memory_usage >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(safeStats.memory_usage, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Active Users */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-purple-500" />
                <span className="text-sm font-medium text-gray-700">Active Users</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-gray-900">
                  {safeStats.active_users}
                </span>
              </div>
              <p className="text-sm text-gray-500">Currently online</p>
            </div>
          </div>

          {/* Database Connections */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-orange-500" />
                <span className="text-sm font-medium text-gray-700">DB Connections</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-gray-900">
                  {safeStats.database_connections}
                </span>
              </div>
              <p className="text-sm text-gray-500">Active connections</p>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">System Alerts</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {alerts.map((alert, index) => (
              <div key={index} className="p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getSeverityColor(alert.severity)}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatTime(alert.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900">{alert.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Chart Placeholder */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Trends</h3>
        <div className="h-64 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p>Performance chart would be displayed here</p>
            <p className="text-sm">Integration with charting library needed</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SystemMonitoring;
