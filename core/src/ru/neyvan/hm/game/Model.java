package ru.neyvan.hm.game;

public class Model implements ModelInterface{

	// Heart of game information
	private GameData gameData;
	private Level level;
	private LevelLoader levelLoader;
	// Transition States - responsible for game process
	private BeginState beginState;
	private WaitState waitState;
	private ReactionState reactionState;
	private ChangeState changeState;
	private ExplosionState explosionState;
	private FullFreezingState fullFreezingState;
	private WinState winState;
	private PortalState portalState;
	private ChanceState chanceState;
	private LoseState loseState;
	// Impact States - responsible for influence on game with different effect INDEPENDENTLY of game process
	private ChangeSpeedTimeState changeSpeedTimeState;
	private HelpSurpriseState changeSpeedTimeState;
	private RotationState changeSpeedTimeState;
	private ScreenEffectsState changeSpeedTimeState;
	private TransferenceState changeSpeedTimeState;
	private WarpSurpriseState changeSpeedTimeState;

	public Model(){
		gameData = new GameData();
		levelLoader = new LevelLoader();
		// initialize
	}

	// for preparing game this 2 functions

	public void newGame(int episode){
		level = levelLoader.loadGame(episode, 1);
		gameData.initialize(level);
	}

	public void loadGame(){
		if(gameData.isInitialize()){
			level = levelLoader.loadGame(gameData.getEpisode(), gameData.getLevel());
			gameData.Get
		}else{
			try{
				gameData.load();
			}catch(Exception e){
				Gdx.app.error("Game Model", "Loading next game data and level not executed", exception);
			}
		}
	}

	// for 

	public void startGame(){

	}




	private void finishedGame(){
		gameData.nextLevel(level);
	}

}