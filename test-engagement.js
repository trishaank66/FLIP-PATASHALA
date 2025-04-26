/**
 * Test script for engagement tracking API
 * 
 * This script tests the engagement tracking API endpoints by simulating
 * user interactions and verifying the results from the API.
 */

const apiUrl = 'http://localhost:5000';

async function testEngagementTracking() {
  try {
    console.log('Starting engagement tracking tests...');
    
    // Test tracking an interaction
    console.log('\nTest 1: Track an interaction');
    const trackResponse = await fetch(`${apiUrl}/api/engagement/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: 1,
        interaction_type: 'test_interaction',
        content_id: 100
      })
    });
    
    if (!trackResponse.ok) {
      throw new Error(`Failed to track interaction: ${trackResponse.status} ${trackResponse.statusText}`);
    }
    
    const trackResult = await trackResponse.json();
    console.log('Track response:', trackResult);
    
    // Test getting user engagement
    console.log('\nTest 2: Get user engagement');
    const userEngagementResponse = await fetch(`${apiUrl}/api/engagement/user/1`);
    
    if (!userEngagementResponse.ok) {
      throw new Error(`Failed to get user engagement: ${userEngagementResponse.status} ${userEngagementResponse.statusText}`);
    }
    
    const userEngagement = await userEngagementResponse.json();
    console.log('User engagement:', userEngagement);
    
    // Test getting department engagement
    console.log('\nTest 3: Get department engagement');
    const departmentEngagementResponse = await fetch(`${apiUrl}/api/engagement/department/1`);
    
    if (!departmentEngagementResponse.ok) {
      throw new Error(`Failed to get department engagement: ${departmentEngagementResponse.status} ${departmentEngagementResponse.statusText}`);
    }
    
    const departmentEngagement = await departmentEngagementResponse.json();
    console.log('Department engagement:', departmentEngagement);
    
    // Test getting department trends (AI-powered)
    console.log('\nTest 4: Get department trends (AI-powered)');
    const trendsResponse = await fetch(`${apiUrl}/api/engagement/trends/department/1`);
    
    if (!trendsResponse.ok) {
      throw new Error(`Failed to get department trends: ${trendsResponse.status} ${trendsResponse.statusText}`);
    }
    
    const trends = await trendsResponse.json();
    console.log('Department trends:', trends);
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the tests
testEngagementTracking();