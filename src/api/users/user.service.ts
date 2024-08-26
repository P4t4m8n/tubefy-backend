import argon2 from "argon2";
import {
  IDetailedUser,
  IUser,
  IUserDTO,
  IUserFilters,
  IUserSignupDTO,
} from "./user.model";
import { prisma } from "../../../prisma/prismaClient";
import { IPlaylist } from "../playlists/playlist.model";
import { playlistService } from "../playlists/playlist.service";
import { songService } from "../songs/song.service";
import { getDefaultLikesPlaylist } from "../../services/util";

export class UserService {
  async create(userData: IUserSignupDTO): Promise<IUserDTO> {
    const { password, email, username, imgUrl } = userData;
    const hashedPassword = await argon2.hash(password);
    const newUser = await prisma.user.create({
      data: {
        password: hashedPassword,
        email,
        username,
        imgUrl,
      },
    });

    return newUser;
  }
  async getById(userId: string): Promise<IUserDTO | null> {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    return user;
  }
  async getByUsername(username: string): Promise<IUserDTO | null> {
    const user = await prisma.user.findUnique({
      where: {
        username: username,
      },
    });

    return user;
  }
  async getByEmail(email: string): Promise<IUserDTO | null> {
    const user = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    return user;
  }
  async update(
    id: string,
    userData: Partial<IUserDTO>
  ): Promise<IUserDTO | null> {
    const user = await prisma.user.update({
      where: {
        id: id,
      },
      data: userData,
    });

    return user;
  }
  async remove(id: string): Promise<boolean> {
    await prisma.user.delete({
      where: {
        id: id,
      },
    });

    return true;
  }
  async query(
    filters: IUserFilters = {}
  ): Promise<{ users: IUserDTO[]; total: number }> {
    const users = await prisma.user.findMany({
      where: {
        AND: [
          filters.email ? { email: filters.email } : undefined,
          filters.username ? { username: filters.username } : undefined,
        ].filter(Boolean) as any,
      },
    });
    return { users, total: users.length };
  }
  async getDetailedUser(owner: IUser): Promise<IDetailedUser> {
    const userData = await prisma.user.findUniqueOrThrow({
      relationLoadStrategy: "join",
      where: {
        id: owner.id,
      },
      select: {
        id: true,
        imgUrl: true,
        username: true,
        isAdmin: true,
        email: true,
        playlists: {
          select: {
            id: true,
            name: true,
            isPublic: true,
            imgUrl: true,
            createdAt: true,
            description: true,
            genres: true,
            types: true,
            playlistLikes: {
              where: {
                userId: owner.id,
              },
            },
            playlistSongs: {
              include: {
                song: {
                  select: {
                    id: true,
                    name: true,
                    artist: true,
                    imgUrl: true,
                    duration: true,
                    genres: true,
                    youtubeId: true,
                    addedAt: true,
                    addedBy: {
                      select: {
                        id: true,
                        imgUrl: true,
                        username: true,
                      },
                    },
                    songLikes: {
                      where: {
                        userId: owner.id,
                      },
                      select: {
                        id: true,
                      },
                    },
                  },
                },
              },
            },
            playlistShares: {},
          },
        },
        songLikes: {
          select: {
            song: {
              select: {
                id: true,
                name: true,
                artist: true,
                imgUrl: true,
                duration: true,
                genres: true,
                youtubeId: true,
                addedAt: true,
                addedBy: {
                  select: {
                    id: true,
                    imgUrl: true,
                    username: true,
                  },
                },
              },
            },
          },
        },
        playlistLikes: {
          select: {
            playlist: {
              select: {
                id: true,
                name: true,
                imgUrl: true,
                isPublic: true,
                createdAt: true,
                description: true,
                genres: true,
                types: true,
                playlistLikes: {
                  where: {
                    userId: owner.id,
                  },
                },
                playlistSongs: {
                  include: {
                    song: {
                      select: {
                        id: true,
                        name: true,
                        artist: true,
                        imgUrl: true,
                        duration: true,
                        genres: true,
                        youtubeId: true,
                        addedAt: true,
                        addedBy: {
                          select: {
                            id: true,
                            imgUrl: true,
                            username: true,
                          },
                        },
                        songLikes: {
                          where: {
                            userId: owner.id,
                          },
                          select: {
                            id: true,
                          },
                        },
                      },
                    },
                  },
                },
                playlistShares: {},
              },
            },
          },
        },
        friends: {
          select: {
            status: true,
            id: true,
            createdAt: true,
            friend: {
              select: {
                id: true,
                username: true,
                imgUrl: true,
              },
            },
          },
        },
        friendsRequest: {
          select: {
            status: true,
            id: true,
            createdAt: true,
            friend: {
              select: {
                id: true,
                username: true,
                imgUrl: true,
              },
            },
          },
        },
      },
    });

    const userPlaylists: IPlaylist[] = playlistService.playlistDataToPlaylist(
      userData.playlists
    );

    const likedPlaylistsData = userData?.playlistLikes.map(
      (playlist) => playlist.playlist
    );

    const likedPlaylists: IPlaylist[] =
      playlistService.playlistDataToPlaylist(likedPlaylistsData);

    const songsData = userData.songLikes.map((song) => song.song);
    const songs = songService.songDataToSong(songsData);

    const idx = userPlaylists.findIndex(
      (playlist) => playlist.name === "Liked Songs"
    );

    let likedSongsPlaylist = userPlaylists.splice(idx, 1)[0];
    //Check in case the user has no liked songs playlist
    if (!likedSongsPlaylist) {
      const playlistToSave = getDefaultLikesPlaylist(userData.id);
      likedSongsPlaylist = await playlistService.create(
        playlistToSave,
        userData
      );
    }

    likedSongsPlaylist.songs = songs;

    const { id, imgUrl, username, email, isAdmin, friends, friendsRequest } =
      userData;

    const user: IDetailedUser = {
      playlists: [...userPlaylists, ...likedPlaylists],
      likedSongsPlaylist,
      id,
      imgUrl,
      username,
      email,
      isAdmin,
      friendsRequest,
      friends,
    };

    return user;
  }
}

export const userService = new UserService();
