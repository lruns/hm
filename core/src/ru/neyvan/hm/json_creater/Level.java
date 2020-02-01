package ru.neyvan.hm.json_creater;

import java.io.Serializable;
import java.util.ArrayList;

import ru.neyvan.hm.surprises.Surprise;
import ru.neyvan.hm.terms.Term;

/**
 * Created by AndyGo on 08.01.2018.
 */

public class Level implements Serializable{
    // Data about count of level, episode, background
    private int episode;
    private int count_level;
    private int i_background;
    // System of counting numbers (from 1 to 50  OR from 100 to 33)
    // P.S. if "fixedCounting == true" that instead "deltaNumbers" used a list "fixedNumbers" for change number of game
    private int firstNumber;
    private int countOfMoves;
    private int deltaNumbers;
    private boolean fixedCounting;
    private ArrayList<Integer> fixedNumbers;
    // Terms of win
    private ArrayList<Term> terms;
    private ArrayList<Check> checksOfMove;
    // Contoller of time
    // P.S. SpeedChangeTS change timeStep and timeAfterStep every move (move 2 => timeStep+=SpeedChangeTS and timeAfterStep+=SpeedChangeTS)
    // P.S.2 AccelerationSpeedChangeTS change SpeedChangeTS every move (move 2 => SpeedChangeTS+= AccelerationSpeedChangeTS before change timeStep)
    // P.S.3 SpeedChangeTS and AccelerationSpeedChangeTS can equals zero
    private float timeStep;
    private float timeAfterStep;
    private float SpeedChangeTS;
    private float AccelerationSpeedChangeTS;
    // bonuses and debuffes
    private ArrayList<Surprise> surprises;
    private ArrayList<Integer> listOfPlacesSurp; //place of appearance surprises in moves
    private boolean outOfOrderAppearanceSurprise; //  = true means, that surprise can generate not in the order of the list (ignore the order of surprises, but NOT ignore listOfPlacesSurp)
    private boolean randomSurpriseMove; // = true means, that surprise can generate in any move (ignore listOfPlacesSurp)

    public int getEpisode() {
        return episode;
    }

    protected void setEpisode(int episode) {
        this.episode = episode;
    }

    public int getCount_level() {
        return count_level;
    }

    protected void setCount_level(int count_level) {
        this.count_level = count_level;
    }

    public int getI_background() {
        return i_background;
    }

    protected void setI_background(int i_background) {
        this.i_background = i_background;
    }

    public int getFirstNumber() {
        return firstNumber;
    }

    protected void setFirstNumber(int firstNumber) {
        this.firstNumber = firstNumber;
    }

    public int getCountOfMoves() {
        return countOfMoves;
    }

    protected void setCountOfMoves(int countOfMoves) {
        this.countOfMoves = countOfMoves;
    }

    public int getDeltaNumbers() {
        return deltaNumbers;
    }

    protected void setDeltaNumbers(int deltaNumbers) {
        this.deltaNumbers = deltaNumbers;
    }

    public boolean isFixedCounting() {
        return fixedCounting;
    }

    protected void setFixedCounting(boolean fixedCounting) {
        this.fixedCounting = fixedCounting;
    }

    public ArrayList<Integer> getFixedNumbers() {
        return fixedNumbers;
    }

    protected void setFixedNumbers(ArrayList<Integer> fixedNumbers) {
        this.fixedNumbers = fixedNumbers;
    }

    public ArrayList<Term> getTerms() {
        return terms;
    }

    protected void setTerms(ArrayList<Term> terms) {
        this.terms = terms;
    }

    public ArrayList<Check> getChecksOfMove() {
        return checksOfMove;
    }

    protected void setChecksOfMove(ArrayList<Check> checksOfMove) {
        this.checksOfMove = checksOfMove;
    }

    public float getTimeStep() {
        return timeStep;
    }

    protected void setTimeStep(float timeStep) {
        this.timeStep = timeStep;
    }

    public float getTimeAfterStep() {
        return timeAfterStep;
    }

    protected void setTimeAfterStep(float timeAfterStep) {
        this.timeAfterStep = timeAfterStep;
    }

    public float getSpeedChangeTS() {
        return SpeedChangeTS;
    }

    protected void setSpeedChangeTS(float speedChangeTS) {
        SpeedChangeTS = speedChangeTS;
    }

    public float getAccelerationSpeedChangeTS() {
        return AccelerationSpeedChangeTS;
    }

    protected void setAccelerationSpeedChangeTS(float accelerationSpeedChangeTS) {
        AccelerationSpeedChangeTS = accelerationSpeedChangeTS;
    }

    public ArrayList<Surprise> getSurprises() {
        return surprises;
    }

    protected void setSurprises(ArrayList<Surprise> surprises) {
        this.surprises = surprises;
    }

    public ArrayList<Integer> getListOfPlacesSurp() {
        return listOfPlacesSurp;
    }

    protected void setListOfPlacesSurp(ArrayList<Integer> listOfPlacesSurp) {
        this.listOfPlacesSurp = listOfPlacesSurp;
    }

    public boolean isOutOfOrderAppearanceSurprise() {
        return outOfOrderAppearanceSurprise;
    }

    protected void setOutOfOrderAppearanceSurprise(boolean outOfOrderAppearanceSurprise) {
        this.outOfOrderAppearanceSurprise = outOfOrderAppearanceSurprise;
    }

    public boolean isRandomSurpriseMove() {
        return randomSurpriseMove;
    }

    protected void setRandomSurpriseMove(boolean randomSurpriseMove) {
        this.randomSurpriseMove = randomSurpriseMove;
    }

    @Override
    public String toString() {
        return  "episode " + episode + "\n"+
                "count_level " + count_level +"\n"+
                "i_background " + i_background +"\n"+
                "firstNumber " + firstNumber +"\n"+
                "countOfMoves " + countOfMoves +"\n"+
                "deltaNumbers " + deltaNumbers +"\n"+
                "fixedCounting " + fixedCounting +"\n"+
                "fixedNumbers " + fixedNumbers +"\n"+
                "terms " + terms +"\n"+
                "checksOfMove " + checksOfMove +"\n"+
                "timeStep " + timeStep +"\n"+
                "timeAfterStep " + timeAfterStep +"\n"+
                "SpeedChangeTS " + SpeedChangeTS +"\n"+
                "AccelerationSpeedChangeTS " + AccelerationSpeedChangeTS +"\n"+
                "surprises " + surprises +"\n"+
                "listOfPlacesSurp " + listOfPlacesSurp +"\n"+
                "outOfOrderAppearanceSurprise " + outOfOrderAppearanceSurprise +"\n"+
                "randomSurpriseMove " + randomSurpriseMove +"\n";
    }
}
