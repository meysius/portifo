import { SWLogger } from "simple-wire";
import { WatchlistRepo } from "./watchlist.repo";
import { WatchlistItemsSelect } from "./watchlist.schema";

export class WatchlistService {
  constructor(
    private readonly logger: SWLogger,
    private readonly watchlistRepo: WatchlistRepo,
  ) {}

  async list(userId: string): Promise<WatchlistItemsSelect[]> {
    return this.watchlistRepo.listByUser(userId);
  }

  async add(userId: string, symbol: string): Promise<WatchlistItemsSelect> {
    return this.watchlistRepo.add(userId, symbol);
  }

  async remove(userId: string, symbol: string): Promise<void> {
    await this.watchlistRepo.remove(userId, symbol);
  }
}
