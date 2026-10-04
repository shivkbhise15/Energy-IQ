export const mockDashboard = {
  generatedAt: new Date().toISOString(),
  widgets: {
    currentConsumptionKw: 684.2,
    todayConsumptionKwh: 12840,
    monthlyConsumptionKwh: 384900,
    predictedMonthlyBillUsd: 53886,
    activeAlerts: 18,
    efficiencyScore: 87
  },
  charts: {
    hourlyUsage: Array.from({ length: 24 }, (_, index) => ({
      timestamp: new Date(Date.now() - (23 - index) * 60 * 60 * 1000).toISOString(),
      value: Math.round((410 + Math.sin(index / 2) * 90 + index * 9) * 10) / 10
    })),
    dailyUsage: Array.from({ length: 30 }, (_, index) => ({
      timestamp: new Date(Date.now() - (29 - index) * 24 * 60 * 60 * 1000).toISOString(),
      value: Math.round((8200 + Math.sin(index / 3) * 1200 + index * 110) * 10) / 10
    })),
    weeklyUsage: Array.from({ length: 7 }, (_, index) => ({
      timestamp: new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000).toISOString(),
      value: Math.round((62000 + Math.sin(index) * 4500) * 10) / 10
    })),
    monthlyUsage: Array.from({ length: 12 }, (_, index) => ({
      timestamp: new Date(2026, index, 1).toISOString(),
      value: Math.round((285000 + Math.sin(index / 1.4) * 36000 + index * 9200) * 10) / 10
    })),
    deviceComparison: [
      { name: "Chiller Plant", value: 91800 },
      { name: "Server Racks", value: 74400 },
      { name: "Compressors", value: 62300 },
      { name: "HVAC East", value: 58900 },
      { name: "Lighting Grid", value: 31400 }
    ],
    buildingComparison: [
      { name: "Building A", value: 108400 },
      { name: "Building B", value: 95800 },
      { name: "Building C", value: 82400 },
      { name: "Building D", value: 59600 }
    ]
  },
  tables: {
    topConsumers: [
      { rank: 1, name: "Chiller Plant", consumptionKwh: 91800, change: 14 },
      { rank: 2, name: "Server Rack Hall 2", consumptionKwh: 74400, change: 9 },
      { rank: 3, name: "Compressor 4", consumptionKwh: 62300, change: 21 },
      { rank: 4, name: "HVAC Unit 7", consumptionKwh: 58900, change: -4 },
      { rank: 5, name: "Lighting Grid West", consumptionKwh: 31400, change: 6 }
    ],
    recentAlerts: [
      { id: "a1", level: "CRITICAL", title: "Compressor 4 usage spike", device: { name: "Compressor 4" }, building: { name: "Building A" }, createdAt: new Date().toISOString() },
      { id: "a2", level: "WARNING", title: "HVAC Unit 7 after-hours load", device: { name: "HVAC Unit 7" }, building: { name: "Building B" }, createdAt: new Date().toISOString() },
      { id: "a3", level: "INFO", title: "Sensor heartbeat delayed", device: { name: "Lighting Grid West" }, building: { name: "Building C" }, createdAt: new Date().toISOString() }
    ],
    recentRecommendations: [
      { id: "r1", impact: "HIGH", title: "Shift compressor runtime window", narrative: "Compressor 4 shows 27% avoidable load after the production line shuts down.", estimatedSavingsUsd: 8400, device: { name: "Compressor 4" } },
      { id: "r2", impact: "MEDIUM", title: "Inspect HVAC filters", narrative: "HVAC Unit 7 is diverging from similar units under comparable ambient conditions.", estimatedSavingsUsd: 4200, device: { name: "HVAC Unit 7" } },
      { id: "r3", impact: "MEDIUM", title: "Tune lighting schedule", narrative: "West wing lighting remains above baseline between 23:00 and 04:00.", estimatedSavingsUsd: 2600, device: { name: "Lighting Grid West" } }
    ]
  }
};

export const mockBuildings = [
  { id: "b1", name: "Building A", city: "Mumbai", areaSqFt: 82000, _count: { floors: 4, rooms: 24, devices: 28, alerts: 3 } },
  { id: "b2", name: "Building B", city: "Bengaluru", areaSqFt: 74000, _count: { floors: 3, rooms: 21, devices: 24, alerts: 5 } },
  { id: "b3", name: "Building C", city: "Pune", areaSqFt: 66000, _count: { floors: 3, rooms: 18, devices: 22, alerts: 4 } },
  { id: "b4", name: "Building D", city: "Hyderabad", areaSqFt: 58000, _count: { floors: 2, rooms: 16, devices: 26, alerts: 2 } }
];

export const mockDevices = [
  { id: "d1", name: "Chiller Plant", type: "HVAC", status: "ONLINE", building: { id: "b1", name: "Building A" }, _count: { sensors: 18, alerts: 2, recommendations: 1 } },
  { id: "d2", name: "Compressor 4", type: "COMPRESSOR", status: "MAINTENANCE", building: { id: "b1", name: "Building A" }, _count: { sensors: 6, alerts: 4, recommendations: 2 } },
  { id: "d3", name: "Server Rack Hall 2", type: "SERVER_RACK", status: "ONLINE", building: { id: "b4", name: "Building D" }, _count: { sensors: 42, alerts: 1, recommendations: 0 } },
  { id: "d4", name: "Lighting Grid West", type: "LIGHTING", status: "ONLINE", building: { id: "b3", name: "Building C" }, _count: { sensors: 12, alerts: 2, recommendations: 1 } },
  { id: "d5", name: "Water Pump 8", type: "WATER_PUMP", status: "OFFLINE", building: { id: "b2", name: "Building B" }, _count: { sensors: 5, alerts: 3, recommendations: 0 } }
];

export const mockAlerts = mockDashboard.tables.recentAlerts.map((alert) => ({
  ...alert,
  status: "OPEN",
  description: alert.title,
  acknowledgedAt: null,
  resolvedAt: null,
  sensor: null
}));
