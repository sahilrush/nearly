import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function runTests() {
  console.log('Starting database tests...')

  try {
    // Test 1: Database Connection
    console.log('\n Testing database connection...')
    await prisma.$connect()
    console.log(' Database connection successful!')

    // Test 2: Create User
    console.log('\n Testing user creation...')
    const testUser = await prisma.user.create({
      data: {
        username: `testuser_${randomUUID()}`,
        email: `test_${randomUUID()}@example.com`,
        password: 'test_password'
      }
    })
    console.log('User created successfully:', testUser.id)

    // Test 3: Create Location for User
    console.log('\n Testing location creation...')
    const testLocation = await prisma.location.create({
      data: {
        userId: testUser.id,
        latitude: "37.7749",
        longitude: "-122.4194"
      }
    })
    console.log(' Location created successfully:', testLocation)

    // Test 4: Read User with Location
    console.log('\n Testing user retrieval with location...')
    const retrievedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
      include: { location: true }
    })
    console.log(' User retrieved successfully:', retrievedUser)

    // Test 5: Update Location
    console.log('\n Testing location update...')
    const updatedLocation = await prisma.location.update({
      where: { userId: testUser.id },
      data: {
        latitude: "40.7128",
        longitude: "-74.0060"
      }
    })
    console.log(' Location updated successfully:', updatedLocation)

    // Test 6: Delete User (should cascade to location)
    console.log('\n Testing user deletion...')
    await prisma.user.delete({
      where: { id: testUser.id }
    })
    
    // Verify deletion
    const deletedUser = await prisma.user.findUnique({
      where: { id: testUser.id }
    })
    const deletedLocation = await prisma.location.findUnique({
      where: { userId: testUser.id }
    })
    
    if (!deletedUser && !deletedLocation) {
      console.log('s User and location deleted successfully!')
    } else {
      throw new Error('Deletion verification failed')
    }

    // Test 7: Concurrent Operations
    console.log('\n Testing concurrent operations...')
    const users = await Promise.all(
      Array(5).fill(null).map((_, i) => 
        prisma.user.create({
          data: {
            username: `concurrent_user_${i}_${randomUUID()}`,
            email: `concurrent_${i}_${randomUUID()}@example.com`,
            password: 'test_password'
          }
        })
      )
    )
    console.log(' Concurrent operations successful!')

    // Clean up concurrent test users
    await prisma.user.deleteMany({
      where: {
        id: { in: users.map(u => u.id) }
      }
    })

    console.log('\nAll tests completed successfully!')

  } catch (error) {
    console.error('\n Test failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
    console.log('\n Database connection closed')
  }
}

// Run the tests
runTests()
  .catch(e => {
    console.error('Error in tests:', e)
    process.exit(1)
  })