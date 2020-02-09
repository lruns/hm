public interface GameObserver{
	public void updateLife();
	public void updateScore();
	public void updateLevelInfo();
	public void updateDisplay(); // Where number and surprises will be displayed
	public void updateTimeBar();
	public void updateProgress();

}