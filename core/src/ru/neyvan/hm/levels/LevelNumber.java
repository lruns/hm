package  ru.neyvan.hm.levels;

import ru.neyvan.hm.Constants;

public class LevelNumber {
	private int episode;
	private int level;

	public LevelNumber(){
		episode = 1;
		level = 1;
	}
	
	public LevelNumber(int episode, int level) {
		try{
			if(episode < 1 || episode > Constants.MAX_EPISODE
				|| level < 1 || level > Constants.MAX_LEVEL[episode-1])
				throw new ArithmeticException("Wrong episode and level numbers!");
		}catch(ArithmeticException e){
			System.err.println(e);
		}
		this.episode = episode;
		this.level = level;			
	}



	public int getEpisode(){
		return episode;
	}

	public int getLevel(){
		return level;
	}

	public int getLevelsSize() {
		return Constants.MAX_LEVEL[episode-1];
	}

	public Difficult getDifficult() {
		return Constants.DIFFICULTS[episode-1];
	}

	// Return true, if is last level of someone episode
	public boolean isLastLevel() {
		return level == Constants.MAX_LEVEL[episode-1];
	}

	// Return true, if is last level of last episode
	public boolean isLastGame() {
		return episode == Constants.MAX_EPISODE-1 && level == Constants.MAX_LEVEL[episode-1];
	}
}