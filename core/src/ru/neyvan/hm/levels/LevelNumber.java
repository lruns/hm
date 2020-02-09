public class LevelNumber {
	private int episode;
	private int level;

	
	public LevelNumber(int episode, int level) {
		try{
			if(episode < 1 || episode > Constants.MAX_EPISODE 
				|| level < 1 || level > Constants.MAX_LEVEL[episode])
				throw new ArithmeticException("Wrong episode and level numbers!");
		}catch(ArithmeticException e){
			System.err.println(e)
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
}