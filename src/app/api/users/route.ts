import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { User, UserRole } from '@/lib/types';
import { hashPassword } from '@/lib/auth';
import { getActiveSession } from '@/lib/authorization';

async function authorize(request: Request) {
  const session = await getActiveSession(request);
  return session?.role === 'Super Admin' ? session : null;
}

function publicUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    lastLoginIp: user.lastLoginIp,
    createdAt: user.createdAt,
    phone: user.phone,
  };
}

export async function GET(request: Request) {
  try {
    if (!await authorize(request)) return NextResponse.json({ error: 'Super Admin access required.' }, { status: 403 });
    const users = await db.getUsers();
    return NextResponse.json({ success: true, users: users.map(publicUser) });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!await authorize(request)) return NextResponse.json({ error: 'Super Admin access required.' }, { status: 403 });
    const body = await request.json();
    const { username, name, role, isActive, phone, password } = body;

    if (!username || !name || !role || !phone || !password) {
      return NextResponse.json({ error: 'Missing required fields (username, name, role, phone, password).' }, { status: 400 });
    }

    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return NextResponse.json({ error: `Username "${username}" is already taken.` }, { status: 400 });
    }

    const newUser: User = {
      id: `usr-${Date.now()}`,
      username: username.toLowerCase().trim(),
      name,
      phone: phone.trim(),
      password: hashPassword(password),
      role: role as UserRole,
      isActive: isActive !== false,
      createdAt: new Date().toISOString()
    };

    await db.saveUser(newUser);
    return NextResponse.json({ success: true, user: publicUser(newUser) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!await authorize(request)) return NextResponse.json({ error: 'Super Admin access required.' }, { status: 403 });
    const body = await request.json();
    const { id, name, role, isActive, phone, password } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    const user = await db.getUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (name) user.name = name;
    if (role) user.role = role as UserRole;
    if (isActive !== undefined) user.isActive = isActive;
    if (phone) user.phone = phone.trim();
    if (password && password.trim() !== '') {
      user.password = hashPassword(password);
    }

    await db.saveUser(user);
    return NextResponse.json({ success: true, user: publicUser(user) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!await authorize(request)) return NextResponse.json({ error: 'Super Admin access required.' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    if (id === 'usr-1') {
      return NextResponse.json({ error: 'The primary Super Admin user account cannot be deleted.' }, { status: 400 });
    }

    const deleted = await db.deleteUser(id);
    if (!deleted) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete user' }, { status: 500 });
  }
}
