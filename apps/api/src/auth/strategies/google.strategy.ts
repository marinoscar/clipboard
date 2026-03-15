import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';

export interface GoogleProfile {
  id: string;
  email: string;
  displayName: string;
  picture?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('google.clientId') || '',
      clientSecret: configService.get<string>('google.clientSecret') || '',
      callbackURL: configService.get<string>('google.callbackUrl') || '',
      scope: ['email', 'profile'],
      proxy: true,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const { id, emails, displayName, photos } = profile;

    const email = emails?.[0]?.value;
    if (!email) {
      return done(new Error('No email found in Google profile'), false);
    }

    const googleProfile: GoogleProfile = {
      id,
      email,
      displayName,
      picture: photos?.[0]?.value,
    };

    done(null, googleProfile);
  }
}
