import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { User, UserRole } from '@/lib/types';

export async function GET() {
  try {
    const users = db.getUsers();
    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, name, role, isActive } = body;

    if (!username || !name || !role) {
      return NextResponse.json({ error: 'Missing username, name or role.' }, { status: 400 });
    }

    const existingUser = db.getUserByUsername(username);
    if (existingUser) {
      return NextResponse.json({ error: `Username "${username}" is already taken.` }, { status: 400 });
    }

    const newUser: User = {
      id: `usr-${Date.now()}`,
      username: username.toLowerCase().trim(),
      name,
      role: role as UserRole,
      isActive: isActive !== false,
      createdAt: new Date().toISOString()
    };

    db.saveUser(newUser);
    return NextResponse.json({ success: true, user: newUser });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, name, role, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    const user = db.getUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (name) user.name = name;
    if (role) user.role = role as UserRole;
    if (isActive !== undefined) user.isActive = isActive;

    db.saveUser(user);
    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    if (id === 'usr-1') {
      return NextResponse.json({ error: 'The primary Super Admin user account cannot be deleted.' }, { status: 400 });
    }

    const deleted = db.deleteUser(id);
    if (!deleted) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete user' }, { status: 500 });
  }
}
