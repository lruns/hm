public class View implements GUIInterface {
	GUIInterface model;
	ControllerInterface controller; //Play screen

	public View(ControllerInterface controller, GUIInterface model){
		this.model = model;
		this.controller = controller;
		model.registerObserver(this);
	}

	public void createView(){
		
	}

	public void updateLife(){

	}
	public void updateScore(){

	}
	public void updateLevelInfo(){

	}
	// Where number and surprises will be displayed
	public void updateDisplay(){

	}
	public void updateTimeBar(){

	}
	public void updateProgress(){

	}

}