package ru.neyvan.hm.states;

public abstract class State{
	private float time;
	private Model model;
	public State(Model model){
		this.model = model;
	}
	public void start();
	public void update(float delta){
		time -= delta;
		if(time < 0) end();
	}
	public void end();
}